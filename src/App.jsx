import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, getProfile, getPlaylistContents } from "./auth.js"
import "./App.css";
import TextEditor from "./TextEditor.jsx"
import SelectableList from "./SelectableList.jsx";

function App() {
  const ENTRIES_PER_PAGE = 20;
  const [pageIndex, setPageIndex] = useState(1);

  const [pageIndexSetter, setPageIndexSetter] = useState(1);

  // https://f4.bcbits.com/img/a0401863863_16.jpg
  // const [albumThumbSrc, setAlbumThumbSrc] = useState(null)

  const [selectedTrack, setSelectedTrack] = useState("");
  const [multiItem, setMultiItem] = useState([]);  // dud for now

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('Jo Doe');
  const [pfp, setPfp] = useState('https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg');

  const [playlistPage, setPlaylistPage] = useState(null);

  function selectedEntry(newId) {
    if (playlistPage != null) {
      setSelectedTrack(newId)
      for (const entry of playlistPage.items) {
        if (entry.id == newId) {
          setAlbumThumbSrc(entry.icon);
          console.log("yeah it works");
          return
        }
        console.log(entry)
        console.log(newId)
      }
      setAlbumThumbSrc(null);
    }
  }

  useEffect(() => {
    const check = async () => {
      try {
        // TODO: is a window.requestedAuth attr needed?
        let profile = await getProfile();
        console.log("[debug] profile retrieved: ", profile)
        localStorage.setItem("logged_on", profile.logged_in);
        setIsLoggedIn(profile.logged_in);
        setUsername(profile.name);
        setPfp(profile.pfp);
        // setPlaylist(await get_the_playlist())
      } catch (err) {
        console.log(err)
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, []);

  useEffect(() => {
    const check = async () => {
      if (isLoggedIn) {
        let conts = await getPlaylistContents(pageIndex - 1, ENTRIES_PER_PAGE);
        setPlaylistPage(conts);
      }
    };

    check();
  }, [isLoggedIn]);

  useEffect(() => {
    setPageIndexSetter(pageIndex)
  }, [pageIndex]);

  function onPageIndexSetterChange(e) {
    if (e.target.checkValidity()) {
      setPageIndexSetter(e.target.value);
    }
  }

  function pageIndexSubmitter(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      setPageIndex(pageIndexSetter);
      e.target.blur();
    }
  }

  console.warn(pageIndex);

  if (loading) return <p>Loading data...</p>;
  if (error) return <p>Error?: {error.message} {error}</p>;

  console.log(playlistPage);
  let listing = [];
  if (playlistPage) {
    listing = playlistPage.items.map((entry, index) => {
      const item = {
        index: playlistPage.offset + index + 1,
        id: entry.id,
        display: entry.title
      }
      return item
    })
    console.log(playlistPage.offset);
    console.log(playlistPage.limit);
  }


  return (
    <main className="higher-power">
      <div className="header">
        <div className="title-and-tabs">
          <h1>StoneRank</h1>

          <div className="header-tab-btn-container">
            <button className="header-tab-btn" type="submit">Home</button>
            <button className="header-tab-btn" type="submit">Downloads</button>
            <button className="header-tab-btn" type="submit">Format</button>
            <button className="header-tab-btn header-tab-btn-login" type="submit" onClick={triggerLogin}>Login</button>
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
          <div className="integrated-player">
            {/* <h2 className="section-title">Spotify Player</h2> */}
            {/* <button id="togglePlay" onClick={onPlayToggle}>Toggle Play</button> */}
            <iframe style={{border: "none"}} src={`https://open.spotify.com/embed/track/${selectedTrack}?utm_source=generator`} width="100%" height="100%" frameBorder="0" allowFullScreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
          </div>
          {/* <div className="source-selector">
            <h2 className="section-title">Player Picker</h2>
          </div> */}
          <div className="unranked-list">
            {/* <h2 className="section-title">Unranked List</h2> */}
            {isLoggedIn && playlistPage && 
            <>
              <div className="list-container">
                <SelectableList
                  id="track-selector-from-playlist"
                  select={selectedTrack}
                  setSelect={selectedEntry}
                  multiSelect={multiItem}
                  setMultiSelect={setMultiItem}
                  items={listing}
                />
              </div>
              <div className="pagination-options">
                <button>{"<<"}</button>
                <button>{"<"}</button>
                <input
                  type="text"
                  value={pageIndexSetter}
                  onChange={onPageIndexSetterChange}
                  pattern="\d+"
                  onBlur={pageIndexSubmitter}
                  onKeyDown={(e) => e.keyCode == 13 && pageIndexSubmitter(e)}
                  onSubmit={pageIndexSubmitter}
                />
                <button>{">"}</button>
                <button>{">>"}</button>
              </div>
            </>
            }
          </div>
          {/* <div className="ranked-list">
            <h2 className="section-title">Ranked List</h2>
            <ul></ul>
          </div> */}
          <div className="text-modifier">
            <h2 className="section-title">Comment Editor</h2>
            <TextEditor />
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
