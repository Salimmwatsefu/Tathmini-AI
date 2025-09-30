import sys
import json
import asyncio
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import google.generativeai as genai
import io
import os
import logging
from dotenv import load_dotenv
from starlette.requests import Request
from starlette.datastructures import UploadFile as StarletteUploadFile

# Load .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://tathmini-ai.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-csv")
async def upload_csv(file: UploadFile):
    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Read CSV in memory
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        logger.error(f"Failed to read CSV: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid CSV format")

    # Normalize column names to lowercase and strip whitespace
    df.columns = df.columns.str.lower().str.strip()

    # Select only required columns, if they exist
    expected_columns = ["items", "debit", "credit"]
    available_columns = [col for col in expected_columns if col in df.columns]
    if len(available_columns) != 3:
        logger.error(f"Expected columns {expected_columns}, found {list(df.columns)}")
        raise HTTPException(status_code=400, detail=f"CSV must have columns: {', '.join(expected_columns)}")
    df = df[expected_columns]

    # Filter out invalid rows (footer or non-numeric items)
    df = df[df["items"].notna() & ~df["items"].str.contains("Accrual Basis|Total", na=False, case=False)]

    # Clean and convert numeric columns
    for col in ["debit", "credit"]:
        df[col] = df[col].astype(str).str.replace(",", "").str.strip()
        df[col] = df[col].replace("", "0").replace("nan", "0")
        try:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            if df[col].isna().any():
                invalid_rows = df[df[col].isna()][["items", col]]
                logger.error(f"Invalid numeric values in {col}: {invalid_rows.to_dict()}")
                raise HTTPException(status_code=400, detail=f"Invalid numeric values in {col}")
        except Exception as e:
            logger.error(f"Error converting {col} to numeric: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid numeric values in {col}")

    # Validation: Check if debits == credits
    total_debit = df["debit"].sum()
    total_credit = df["credit"].sum()
    is_balanced = abs(total_debit - total_credit) < 0.01
    balance_message = (
        f"Balanced: Total Debit = {total_debit:.2f}, Total Credit = {total_credit:.2f}"
        if is_balanced
        else f"Unbalanced: Total Debit = {total_debit:.2f}, Total Credit = {total_credit:.2f}"
    )

    # Anomaly Detection with Rule-Based Filtering
    features = df[["debit", "credit"]]
    contamination = min(0.05, 10 / len(df)) if len(df) > 0 else 0.05
    model = IsolationForest(contamination=contamination, random_state=42)
    df["anomaly_score"] = model.fit_predict(features)
    
    # Rule-based filtering
    amount_threshold = max(10000, df[["debit", "credit"]].quantile(0.95).max())  # 95th percentile or $10,000
    imbalance_threshold = 5000  # For debit/credit imbalance
    df["is_significant_anomaly"] = (
        (df["anomaly_score"] == -1) &
        (
            (df["debit"] > amount_threshold) | (df["credit"] > amount_threshold) |
            ((df["debit"] > imbalance_threshold) & (df["credit"] == 0)) |
            ((df["credit"] > imbalance_threshold) & (df["debit"] == 0))
        )
    )
    
    anomalies = df[df["is_significant_anomaly"]][["items", "debit", "credit"]]
    logger.info(f"Detected {len(anomalies)} significant anomalies: {anomalies.to_dict(orient='records')}")
    anomalies = anomalies[["items", "debit", "credit"]].to_dict(orient="records")
    anomaly_summary = f"{len(anomalies)} significant anomalies detected" if anomalies else "No significant anomalies detected"

    # AI Recommendations with Gemini 2.5 Flash
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.error("GEMINI_API_KEY not found in environment variables")
        recommendations = "Error: GEMINI_API_KEY not set"
    else:
        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        ai_prompt = f"""
        Analyze these significant financial anomalies from a CSV (items, debit, credit):
        {anomalies}
        Provide 5-8 concise audit recommendations (each 100-150 characters) in Markdown bullet points, focusing on high-value transactions or imbalances. Ensure clear, actionable steps.
        Example:
        - Verify land transaction documentation for compliance and authorization.
        - Check foreign currency account for accurate exchange rate application.
        """
        try:
            response = model.generate_content(ai_prompt)
            recommendations = response.text.strip()
            logger.info(f"Generated recommendations: {recommendations}")
            # Ensure Markdown bullet points
            if not recommendations.startswith("- "):
                recommendations = "- " + "\n- ".join(recommendations.split("\n"))
        except Exception as e:
            logger.error(f"AI error: {str(e)}")
            recommendations = f"AI error: {str(e)}"

    # Return response
    return JSONResponse({
        "balance_status": balance_message,
        "anomalies": anomalies,
        "recommendations": recommendations
    })

async def main():
    # Read input from stdin (sent by api.js)
    input_data = sys.stdin.read()
    event = json.loads(input_data)

    # Create a Starlette Request object
    scope = {
        "type": "http",
        "method": event["httpMethod"],
        "path": event["path"],
        "headers": event.get("headers", {}),
        "query_string": event.get("queryStringParameters", {}),
        "body": event.get("body", "")
    }
    request = Request(scope)

    # Handle file upload for POST /upload-csv
    if event["httpMethod"] == "POST" and event["path"].endswith("/upload-csv"):
        content_type = event["headers"].get("content-type", "").lower()
        if "multipart/form-data" in content_type:
            # Simulate file upload from body (multipart/form-data)
            file_content = event["body"]  # Adjust for actual multipart parsing
            file = StarletteUploadFile(
                filename="uploaded.csv",
                file=io.BytesIO(file_content.encode() if isinstance(file_content, str) else file_content),
                content_type="text/csv"
            )
            response = await upload_csv(file)
        else:
            response = {"error": "Invalid content type"}
    else:
        response = {"error": "Invalid request"}

    # Output JSON response to stdout
    print(json.dumps({
        "statusCode": 200 if "error" not in response else 400,
        "body": response,
        "headers": {"Content-Type": "application/json"}
    }))
    sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(main())