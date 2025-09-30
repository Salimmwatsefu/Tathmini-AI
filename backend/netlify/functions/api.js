const { spawn } = require('child_process');

exports.handler = async function (event, context) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3.12', ['api.py'], {
      cwd: __dirname,
      env: { ...process.env, PYTHONPATH: __dirname }
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const response = JSON.parse(output);
          resolve({
            statusCode: response.statusCode || 200,
            body: JSON.stringify(response.body),
            headers: response.headers || { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e.message}`));
        }
      } else {
        reject(new Error(`Python process exited with code ${code}: ${errorOutput}`));
      }
    });

    // Pass the HTTP request to the Python process
    pythonProcess.stdin.write(JSON.stringify({
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
      body: event.body,
      queryStringParameters: event.queryStringParameters
    }));
    pythonProcess.stdin.end();
  });
};