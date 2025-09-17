import { useState } from "react";

import "./App.css";
function App() {
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file!");

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
      alert("Summarization failed");
    }

    setLoading(false);
  };

  const handleDownload = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "summary.txt";
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=800,height=600");
    printWindow.document.write("<pre>" + summary + "</pre>");
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="appContainer">
      <h1>Document Summarizer</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Upload Document:
          <input type="file" onChange={handleFileChange} />
        </label>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Summarizing..." : "Summarize"}
        </button>
      </form>

      {summary && (
        <div className="summaryContainer">
          <h2 className="summaryHeader">Summary</h2>
          <pre className="pre">{summary}</pre>
          <div className="btnActions">
            <button onClick={handleDownload} className="button">
              Download Summary
            </button>
            <button onClick={handlePrint} className="button">
              Print Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
