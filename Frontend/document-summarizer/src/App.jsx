import "./App.css";

function App() {
  return (
    <div className="appContainer">
      <h1 className="header">Well Come to your Document Summarizer</h1>
      <form className="form">
        <label>
          upload your Document:
          <input type="text" className="input" />
        </label>
        <button className="btn">Submit</button>
      </form>
    </div>
  );
}

export default App;
