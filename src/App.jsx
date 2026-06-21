import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, triggerLogOff, getProfile, getPlaylistContents } from "./auth.js"
import "./App.css";
import { useSelectableList } from "./components/SelectableList.jsx";
import LazySelectorList from "./LazySelectorList.jsx";
import CommentSection from "./components/CommentSection.jsx";
import { LoginContext } from "./contexts.js";
import PreviewSection from "./components/PreviewSection.jsx";
import SelectorSection from "./components/SelectorSection.jsx";

const plPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]*)/

function App() {
  const list = useSelectableList({ multiSelect: false });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('Jo Doe');
  const [pfp, setPfp] = useState('https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg');

  // https://f4.bcbits.com/img/a0401863863_16.jpg
  // const [albumThumbSrc, setAlbumThumbSrc] = useState(null)

  /**
   * [command] gets profile and determines logged in status.
   * 
   * This furthermore determines whether other elements of the page
   * should load.
   */
  async function activateAccount() {
    await getProfile()
    .then((profile) => {
        // TODO: is a window.requestedAuth attr needed?
        console.info("Profile retrieved: ", profile);
        localStorage.setItem("logged_on", profile.logged_in);

        setIsLoggedIn(profile.logged_in);
        setUsername(profile.name);
        setPfp(profile.pfp);
      })
      .catch((e) => {
        setError(e);
        throw e;
      })
      .finally(() => setLoading(false));
  }

  /**
   * [callback] logs out and deletes profile, deselects everything.
   */
  async function deactivateAccount(e) {
    setLoading(true);
    await triggerLogOff()
      .then((profile) => {
        localStorage.setItem("logged_on", profile.logged_in);

        setIsLoggedIn(profile.logged_in);
        setUsername(profile.name);
        setPfp(profile.pfp);

        setSelectedTrack("");
      })
      .catch((e) => {
        setError(e);
        throw e;
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    activateAccount();
  }, []);

  if (loading) return <p>Loading data...</p>;
  if (error) return <p>Error?: {error.message} {error}</p>;

  return (
    <main className="higher-power">
      <LoginContext value={isLoggedIn}>
        <div className="header">
          <div className="title-and-tabs">
            <h1>StoneRank</h1>
            <div className="header-tab-btn-container">
              <button className="header-tab-btn" type="submit">Home</button>
              {/* <button className="header-tab-btn" type="submit">Downloads</button>
              <button className="header-tab-btn" type="submit">Format</button> */}
              <button className="header-tab-btn header-tab-btn-login" type="submit" onClick={triggerLogin}>Login</button>
              <button className="header-tab-btn header-tab-btn-login" type="submit" onClick={deactivateAccount}>Log Out</button>
            </div>
          </div>
          <div className="login-display">
            <p>{username}</p>
            <img src={pfp} height="32" width="32" />
          </div>
        </div>
        <div className="tab-area">
          <div className="hub">
            {/* <div className="cover-display">
              <h2 className="section-title">Album Cover</h2>
              {albumThumbSrc !== null ?
              <img
                className="cover-display-image"
                src={albumThumbSrc}
              />
              :
              <p>No song selected</p>
              }
            </div> */}
            <PreviewSection selectedTrack={list.selected[0]} />
            {/* <div className="source-selector">
              <h2 className="section-title">Player Picker</h2>
            </div> */}
            <SelectorSection list={list} />
            {/* <div className="ranked-list">
              <h2 className="section-title">Ranked List</h2>
              <ul></ul>
            </div> */}
            <CommentSection
              selectedTrack={list.selected[0]}
            />
          </div>
        </div>
      </LoginContext>
      {/*<script src="https://sdk.scdn.co/spotify-player.js"></script>*/}
    </main>
  );
}

export default App;
