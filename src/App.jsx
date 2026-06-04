import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, getProfile, getPlaylistContents } from "./auth.js"
import "./App.css";
import TextEditor from "./TextEditor.jsx"
import SelectableList from "./SelectableList.jsx";

const plPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]*)/

function submitOnEnter(f) {
  return (e) => {
    if (e.keyCode == 13) {
      return f(e)
    }
  };
}

function App() {
  const ENTRIES_PER_PAGE = 20;
  const [pageIndex, setPageIndex] = useState(1);
  const [pageIndexSetter, setPageIndexSetter] = useState(1);

  const [playlist, setPlaylist] = useState("https://open.spotify.com/playlist/6kBCzasJ5DH01MDB3bLPZV?si=MeZsRr1vQXq5mGI9pS3syw&pi=RKenW5kUTyq5j");
  const [playlistInput, setPlaylistInput] = useState("https://open.spotify.com/playlist/6kBCzasJ5DH01MDB3bLPZV?si=MeZsRr1vQXq5mGI9pS3syw&pi=RKenW5kUTyq5j");

  const [plTotal, setPlTotal] = useState(0);
  const [plName, setPlName] = useState("default playlist name");

  const [loadingPlaylist, setLoadingPlaylist] = useState(true);
  const [plExists, setPlExists] = useState(true);

  const [playlistPage, setPlaylistPage] = useState(null);
  const maxPages = Math.ceil(plTotal/ENTRIES_PER_PAGE)

  const [comment, setComment] = useState("testing");
  const [commentInput, setCommentInput] = useState("testing");
  const [commentSaving, setCommentSaving] = useState(0);
  const [commentSavingTimeout, setCommentSavingTimeout] = useState(null);
  
  // https://f4.bcbits.com/img/a0401863863_16.jpg
  // const [albumThumbSrc, setAlbumThumbSrc] = useState(null)

  const [selectedTrack, setSelectedTrack] = useState("");
  const [multiItem, setMultiItem] = useState([]);  // dud for now

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('Jo Doe');
  const [pfp, setPfp] = useState('https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg');

  // === Comments ===

  function onCommentChange(e) {
    setCommentInput(e.target.value || "");
  }

  function onCommentBlur(e) {
    setCommentSaving(1);
    return invoke("save_comment", {trackId: selectedTrack, comment: commentInput})
      .then((r) => {
        setComment(commentInput);
        console.info("comment saving res: ", r);

        setCommentSaving(2);
        clearTimeout(commentSavingTimeout);
        setCommentSavingTimeout(setTimeout(() => setCommentSaving(0), 5000));
      });
  }

  async function getComment() {
    const res = await invoke("get_comment", {trackId: selectedTrack});
    setComment(res)
  }

  useEffect(() => {
    getComment();
  }, [selectedTrack]);

  useEffect(() => {
    console.info(comment)
    setCommentInput(comment)
  }, [comment]);


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
    setPageIndexSetter(pageIndex)
  }, [pageIndex]);

  function onIndexChange(e) {
    if (e.target.checkValidity()) {
      setPageIndexSetter(e.target.value);
    }
  }

  function onIndexSubmit(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      setPageIndex(Math.max(1, Math.min(maxPages, pageIndexSetter)));
      e.target.blur();
    }
  }

  function goToFirstPage(e) {
    if (pageIndex > 1) {
      setPageIndex(1);
    }
  }

  function goToLastPage(e) {
    if (pageIndex < maxPages) {
      setPageIndex(maxPages);
    }
  }

  function goToPreviousPage(e) {
    if (pageIndex > 1) {
      setPageIndex(Math.max(1, Math.min(maxPages, pageIndex - 1)));
    }
  }

  function goToNextPage(e) {
    if (pageIndex < maxPages) {
      setPageIndex(Math.max(1, Math.min(maxPages, pageIndex + 1)));
    }
  }

  // ==== PLAYLIST STUFF ====

  async function initialPlaylistGet() {
    const res = await invoke("get_initial_playlist");
    setPlaylist(res);
    console.info("Retrieved initial playlist: ", res);
  }

  async function getPlaylistDeets() {
    try {
      const res = await invoke("get_current_playlist_details");
      console.info("Retrieved playlist details: ", res);
      setPlName(res.name);
      setPlTotal(res.items.total);
      setPlExists(true);
    } catch (e) {
      setPlName("Playlist not found!");
      setPlTotal(404);
      setPlExists(false);
    }
  }

  async function getPlaylistContents() {
    await invoke("get_playlist_items", {offset: ENTRIES_PER_PAGE * (pageIndex - 1), limit: ENTRIES_PER_PAGE})
      .then((conts) => {
        // use finally and else
        if (conts.items.length !== 0) {
          setSelectedTrack(conts.items[0].id);
        } else {
          setSelectedTrack("");
        }
        setPlaylistPage(conts);
        setLoadingPlaylist(false);
        setPlExists(true);
      })
      .catch((e) => {
        setPlaylistPage(null);
        setSelectedTrack("");
        setLoadingPlaylist(false);
        setPlExists(false);
        throw e;
      })
  }

  useEffect(() => {
    initialPlaylistGet()
  }, [isLoggedIn]);

  useEffect(() => {
    setPlaylistInput(playlist || playlistInput);
    if (playlist !== null && isLoggedIn) {
      getPlaylistDeets()
    }
  }, [isLoggedIn, playlist]);

  useEffect(() => {
    if (isLoggedIn && playlist) {
      setLoadingPlaylist(true);
      setPlExists(true);
      getPlaylistContents()
    }
  }, [isLoggedIn, playlist, pageIndex]);

  function onPlInputChange(e) {
    if (e.target.checkValidity()) {
      setPlaylistInput(e.target.value || "");
    }
  }

  function onPlInputFocus(e) {
    setPlaylistInput(playlist === null ? playlistInput : `https://open.spotify.com/playlist/${playlist}`);
  }

  function getOnlyCode(pl) {
    let code = plPattern.exec(pl);
    if (code === null) {
      console.error("Invalid URL: ", pl);
      return null;
    } if (code[1] === undefined) {
      console.error("Invalid URL: ", pl);
      return null;
    } else {
      return code[1];
    }
  }

  async function onPlSubmit(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      e.target.blur();
      let code = getOnlyCode(playlistInput);
      if (playlist != code) {
        await invoke("set_playlist", {plCode: code});
        setPlaylist(code);
      }

      // this is needed (the useEffect above doesn't change it back)
      setPlaylistInput(code || playlistInput);
    }
  }

  if (loading) return <p>Loading data...</p>;
  if (error) return <p>Error?: {error.message} {error}</p>;

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
  }

  return (
    <main className="higher-power">
      {/*<script src="https://sdk.scdn.co/spotify-player.js"></script>*/}
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
            <iframe style={{border: "none", }} src={`https://open.spotify.com/embed/track/${selectedTrack}?utm_source=generator`} width="100%" height="100%" frameBorder="0" allowFullScreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
          </div>
          {/* <div className="source-selector">
            <h2 className="section-title">Player Picker</h2>
          </div> */}
          <div className="unranked-list">
            {/* <h2 className="section-title">Unranked List</h2> */}
            <div className="playlist-header">
              <div className="playlist-input">
                <label>Playlist: </label>
                <input
                  type="text"
                  value={playlistInput}
                  title="Current playlist url. Paste a new one in if needed!"
                  onChange={onPlInputChange}
                  onFocus={onPlInputFocus}
                  onBlur={onPlSubmit}
                  onKeyDown={submitOnEnter(onPlSubmit)}
                  onSubmit={onPlSubmit}
                />
              </div>
              <div>Playlist Name: {plName}</div>
              <div>Count: {plTotal}</div>
            </div>
            {(isLoggedIn) &&
            <>
              <div className="list-container">
                {(!plExists || loadingPlaylist) &&
                  <div className="playlist-load-notifier">
                    {[...Array(15)].map((_) => {
                      return plExists
                        ? <div key={crypto.randomUUID()}>Loading Playlist...</div>
                        : <div key={crypto.randomUUID()}>Error!!</div>
                      })}
                  </div>
                }
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
                <button disabled={pageIndex <= 1 || !plExists || loadingPlaylist} onClick={goToFirstPage}>{"<<"}</button>
                <button disabled={pageIndex <= 1 || !plExists || loadingPlaylist} onClick={goToPreviousPage}>{"<"}</button>
                <input
                  type="text"
                  value={pageIndexSetter}
                  onChange={onIndexChange}
                  pattern="\d+"
                  onBlur={onIndexSubmit}
                  onKeyDown={submitOnEnter(onIndexSubmit)}
                  onSubmit={onIndexSubmit}
                  disabled={!plExists || loadingPlaylist}
                />
                <button disabled={pageIndex >= maxPages || !plExists || loadingPlaylist} onClick={goToNextPage}>{">"}</button>
                <button disabled={pageIndex >= maxPages || !plExists || loadingPlaylist} onClick={goToLastPage}>{">>"}</button>
              </div>
              <div className="pagination-pages-num">{maxPages} Pages</div>
            </>
            }
          </div>
          {/* <div className="ranked-list">
            <h2 className="section-title">Ranked List</h2>
            <ul></ul>
          </div> */}
          <div className="text-modifier">
            <div className="text-modifier-header">
              <h2>Comment Editor</h2>
              {commentSaving != 0 && (
                commentSaving == 1 ?
                <div className="save-icon">
                  Saving...
                </div>
                :
                <div className="save-icon">
                  Saved!
                </div>
              )
              }
            </div>
            <hr />
            <div className="text-editor">
              <textarea
                onChange={onCommentChange}
                onBlur={onCommentBlur}
                value={commentInput}
                disabled={!plExists || loadingPlaylist}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
