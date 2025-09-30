import './App.css'
import UploadForm from './components/UploadForm'


function App() {

  return (
   <div>
    <div className="min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold text-center p-4">Audit CSV App</h1>
      <UploadForm />
    </div>

   </div>
  )
}

export default App
