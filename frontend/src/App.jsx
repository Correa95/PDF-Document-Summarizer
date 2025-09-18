import { useState } from "react";

import "./App.css";
function App() {
  const [file, setFile] = useState(null);
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
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
      const res = await fetch(`${BACKEND_URL}/api/v1/upload`, {
        method: "POST",
        body: formData,
      });

      const text = await res.text(); // Read raw response
      try {
        const data = JSON.parse(text); // Try parsing JSON
        if (data.summary) {
          setSummary(data.summary);
        } else {
          console.warn("No summary found in response:", data);
          alert("No summary returned. Check backend logs.");
        }
      } catch (parseErr) {
        console.error("Failed to parse JSON:", text);
        alert("Invalid response from server. Check backend.");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Summarization failed. Network or server error.");
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
