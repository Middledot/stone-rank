// import { useState } from "react";
// import reactLogo from "./assets/react.svg";
// import { invoke } from "@tauri-apps/api/core";
// import "./App.css";

// function App() {
//   const [greetMsg, setGreetMsg] = useState("");
//   const [name, setName] = useState("");

//   async function greet() {
//     // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//     setGreetMsg(await invoke("greet", { name }));
//   }

//   return (
//     <main className="container">
//       <h1>Welcome to Tauri + React</h1>

//       <div className="row">
//         <a href="https://vitejs.dev" target="_blank">
//           <img src="/vite.svg" className="logo vite" alt="Vite logo" />
//         </a>
//         <a href="https://tauri.app" target="_blank">
//           <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
//         </a>
//         <a href="https://reactjs.org" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <p>Click on the Tauri, Vite, and React logos to learn more.</p>

//       <form
//         className="row"
//         onSubmit={(e) => {
//           e.preventDefault();
//           greet();
//         }}
//       >
//         <input
//           id="greet-input"
//           onChange={(e) => setName(e.currentTarget.value)}
//           placeholder="Enter a name..."
//         />
//         <button type="submit">Greet</button>
//       </form>
//       <p>{greetMsg}</p>
//     </main>
//   );
// }

// export default App;

import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import "./App.css";

function App() {
  // let fileUrl = convertFileSrc(appDataDir()+"/excursions.jpg")

  const [imgSrc, setImgSrc] = useState("https://f4.bcbits.com/img/a0401863863_16.jpg")


  return (
    <main className="higher-power">
      <div className="general-header">
        <h1>StoneRank</h1>

        <button className="header-button" type="submit">Home</button>
        <button className="header-button" type="submit">Downloads</button>
        <button className="header-button" type="submit">Format</button>
      </div>

      <div className="awe-tab">
        <div className="home">
          <div className="cover-display">
            <h2 className="cover-display-title">Album Cover</h2>
            <img
              className="cover-display-image"
              src={imgSrc}
            />
          </div>
          <div className="integrated-player">
            <h2 className="cover-display-title">Spotify Player</h2>
          </div>
          <div className="source-selector">
            <h2 className="cover-display-title">Player Picker</h2>
          </div>
          <div className="unranked-list">
            <h2 className="cover-display-title">Unranked List</h2>
            {/* 
              TODO:
               - Reusable list interface
            */}
          </div>
          <div className="ranked-list">
            <h2 className="cover-display-title">Ranked List</h2>
          </div>
          <div className="text-modifier">
            <h2 className="cover-display-title">Comment Editor</h2>
            {/* 
              TODO:
               - Text editor
            */}
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
