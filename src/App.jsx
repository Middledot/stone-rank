import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";

import { triggerLogin, triggerLogOff, getProfile, getPlaylistContents } from "./auth.js"
import "./App.css";
import TextEditor from "./TextEditor.jsx"
import SelectableList from "./SelectableList.jsx";

const plPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]*)/

/**
 * [helper] transforms normal submit callbacks into ones that can
 * be triggered via the ENTER key.
 * 
 */
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
  const [pageIndexInput, setPageIndexInput] = useState(1);

  const [playlist, setPlaylist] = useState(null);
  const [playlistInput, setPlaylistInput] = useState("");

  const [plTotal, setPlTotal] = useState(401);
  const [plName, setPlName] = useState("no playlist");

  const [loadingPlaylist, setLoadingPlaylist] = useState(true);
  const [plExists, setPlExists] = useState(true);

  const [playlistPage, setPlaylistPage] = useState(null);
  const maxPages = Math.ceil(plTotal/ENTRIES_PER_PAGE)

  const [comment, setComment] = useState("testing");
  const [commentInput, setCommentInput] = useState("testing");
  const [commentSaving, setCommentSaving] = useState(0);
  const [commentSavingTimeout, setCommentSavingTimeout] = useState(null);

  const [selectedTrack, setSelectedTrack] = useState("");
  const [multiItem, setMultiItem] = useState([]);  // dud for now

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('Jo Doe');
  const [pfp, setPfp] = useState('https://upload.wikimedia.org/wikipedia/commons/a/ac/Default_pfp.jpg');

  // https://f4.bcbits.com/img/a0401863863_16.jpg
  // const [albumThumbSrc, setAlbumThumbSrc] = useState(null)

  // === Comments ===

  /**
   * [callback] for when text is typed into the textarea
   */
  function onCommentChange(e) {
    setCommentInput(e.target.value || "");
  }

  /**
   * [callback] for when the comment textarea is deselected (event is called onBlur).
   * This will save the text written in the input.
   * 
   * This is also triggered when another track is selected from the list.
   */
  function onCommentBlur(e) {
    setCommentSaving(1);
    console.info("Saving comment...")
    return invoke("save_comment", {trackId: selectedTrack, comment: commentInput})
      .then((r) => {
        setComment(commentInput);
        console.info("Comment saved with backend response: ", r);

        setCommentSaving(2);
        clearTimeout(commentSavingTimeout);
        setCommentSavingTimeout(setTimeout(() => setCommentSaving(0), 5000));
      });
  }

  /**
   * [command] that retrieves a comment from the backend.
   */
  async function getComment() {
    const text = await invoke("get_comment", {trackId: selectedTrack});
    setComment(text)
    console.info("Retrieved comment: ", text)
  }

  /**
   * [effect] that changes the comment when the selected track is changed.
   */
  useEffect(() => {
    console.info("Selected track changed! Retrieving comment...")
    getComment();
  }, [selectedTrack]);


  /**
   * [effect] that aligns the input state (commentInput) with the real, saved
   * comment (comment) when comment is changed
   */
  useEffect(() => {
    setCommentInput(comment)
    console.info("Comment input aligned: ", comment)
  }, [comment]);

  /**
   * [callback] when the selection list component wants to set the new entry
   * comment (comment) when comment is changed
   */
  function selectEntry(newId) {
    if (playlistPage === null) {
      console.warn("No playlist data but entry was selected...");
      return;
    }

    setSelectedTrack(newId)
    // TODO: below is all album cover image functionality
    // for (const entry of playlistPage.items) {
    //   if (entry.id == newId) {
    //     setAlbumThumbSrc(entry.icon);
    //     return
    //   }
    //   console.log(entry)
    //   console.log(newId)
    // }
    // setAlbumThumbSrc(null);
  }

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

  // ==== Pagination Controls (pageIndex) ====

  /**
   * [effect] to align the displayed index (pageIndexInput)
   * with the actual page index (pageIndex) when the page index is updated
   * 
   * Happens when the index is saved/sent to backend for processing
   */
  useEffect(() => {
    setPageIndexInput(pageIndex);
    console.info("Page index aligned: ", pageIndex);
  }, [pageIndex]);

  /**
   * [callback] when the visual index is modified.
   */
  function onIndexChange(e) {
    if (e.target.checkValidity()) {
      setPageIndexInput(e.target.value);
    }
  }

  /**
   * [callback] when the visual index is submitted.
   */
  function onIndexSubmit(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      const newIndex = Math.max(1, Math.min(maxPages, pageIndexInput));
      setPageIndex(newIndex);
      console.info("Page index set: ", newIndex);

      // the index stays in focus if you press enter; Here we force blur
      e.target.blur();
    }
  }

  /**
   * [callback] when the [<<] button is pressed
   */
  function goToFirstPage(e) {
    if (pageIndex > 1) {
      console.info("Going to first page...");
      setPageIndex(1);
    }
  }

  /**
   * [callback] when the [>>] button is pressed
   */
  function goToLastPage(e) {
    if (pageIndex < maxPages) {
      console.info("Going to last page...");
      setPageIndex(maxPages);
    }
  }

  /**
   * [callback] when the [<] button is pressed
   */
  function goToPreviousPage(e) {
    if (pageIndex > 1) {
      const newIndex = Math.max(1, Math.min(maxPages, pageIndex - 1));
      setPageIndex(newIndex);
      console.info("Moving backward to page ", newIndex, "...")
    }
  }

  /**
   * [callback] when the [>] button is pressed
   */
  function goToNextPage(e) {
    if (pageIndex < maxPages) {
      const newIndex = Math.max(1, Math.min(maxPages, pageIndex + 1));
      setPageIndex(newIndex);
      console.info("Moving forward to page ", newIndex, "...")
    }
  }

  // ==== Playlists ====

  /**
   * [command] on startup, retrieve the saved playlist code
   */
  async function initialPlaylistGet() {
    const res = await invoke("get_initial_playlist");
    setPlaylist(res);
    console.info("Retrieved initial playlist: ", res);
  }

  /**
   * [command] get the 'deets' for the current playlist.
   * This is metadata such as playlist name and entry count.
   */
  async function getPlaylistDeets() {
    await invoke("get_current_playlist_details")
      .then((res) => {
        console.info("Retrieved playlist details: ", res);
        setPlName(res.name);
        setPlTotal(res.items.total);
        setPlExists(true);
      })
      .catch((e) => {
        setPlName("Playlist not found!");
        setPlTotal(404);
        setPlExists(false);
        throw e;
      })
  }

  /**
   * [command] get the entries of a playlist for the list display.
   * 
   * TODO: this takes a really long time (2-4 seconds)
   */
  async function getPlaylistContents() {
    await invoke("get_playlist_items", {offset: ENTRIES_PER_PAGE * (pageIndex - 1), limit: ENTRIES_PER_PAGE})
      .then((res) => {
        if (res.items.length !== 0) {  // pre-set the selected track
          setSelectedTrack(res.items[0].id);
        } else {
          setSelectedTrack("");
        }
        setPlaylistPage(res);
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

  /**
   * [effect] gets initial playlist details when logged in
   */
  useEffect(() => {
    if (isLoggedIn) {
      initialPlaylistGet()
    }
  }, [isLoggedIn]);
  
  /**
   * [effect] aligns textbox playlist url input with real playlist code.
   * 
   * TODO: this might not be doing anything (refer to comment in onPlSubmit
   */
  useEffect(() => {
    setPlaylistInput(playlist || playlistInput);
    if (playlist !== null && isLoggedIn) {
      getPlaylistDeets()
    } else {
      setPlName("no playlist");
      setPlTotal(401);
      setPlExists(false);
    }
  }, [isLoggedIn, playlist]);
  
  /**
   * [effect] updates playlist listing (uuh..) when pageIndex is changed.
   */
  useEffect(() => {
    if (isLoggedIn && playlist) {
      setLoadingPlaylist(true);
      setPlExists(true);
      getPlaylistContents()
    }
  }, [isLoggedIn, playlist, pageIndex]);

  /**
   * [callback] update playlist url input
   */
  function onPlInputChange(e) {
    if (e.target.checkValidity()) {
      setPlaylistInput(e.target.value || "");
    }
  }

  /**
   * [helper] extracts the code of a playlist from the url.
   * 
   * This is used for code display when not editing, and for backend processing
   * purposes.
   */
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

  /**
   * [callback] on focus, change input display from the code only, to
   * the full url for proper editing
   */
  function onPlInputFocus(e) {
    setPlaylistInput(playlist === null ? playlistInput : `https://open.spotify.com/playlist/${playlist}`);
  }

  /**
   * [callback] generic submitting for the playlist url input.
   * This is called when...
   *   1. input is entered (ENTER key is pressed)
   *   2. input is blurred (clicked off)
   */
  async function onPlSubmit(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      e.target.blur();  // 'entering' doesn't blur automatically

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
    // processes playlist entries into ones readable by SelectableList
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
                  setSelect={selectEntry}
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
                  value={pageIndexInput}
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
                disabled={!isLoggedIn || !plExists || loadingPlaylist}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
