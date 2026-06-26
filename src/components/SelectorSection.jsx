import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

import "../compstyle/SelectorSection.css";
import "../compstyle/SelectableList.css";
import { useLogin } from "../contexts";

/**
 * [helper] transforms normal submit callbacks into ones that can
 * be triggered via the ENTER key.
 * 
 */
function submitOnEnter(f) {
  return (e) => {
    if (e.key == "Enter") {
      return f(e)
    }
  };
}

const plPattern = /https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]*)/
function SelectorSection({ list }) {
  const isLoggedIn = useLogin();

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
  const maxPages = Math.ceil(plTotal/ENTRIES_PER_PAGE);

  /**
   * [callback] when the selection list component wants to set the new entry
   * comment (comment) when comment is changed
   */
  function selectEntry(newId) {
    if (playlistPage === null) {
      console.warn("No playlist data but entry was selected...");
      return;
    }

    list.toggle(newId)
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
          list.setSelected([res.items[0].id]);
        } else {
          list.setSelected([]);
        }
        setPlaylistPage(res);
        setLoadingPlaylist(false);
        setPlExists(true);
      })
      .catch((e) => {
        setPlaylistPage(null);
        list.setSelected([]);
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
    list.setSelected([]);
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
      list.setSelected([]);
      setLoadingPlaylist(true);
      setPlExists(true);
      getPlaylistContents();
      setPlaylistInput(playlist || playlistInput);
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
        setPlaylist(code);
        await invoke("set_playlist", {plCode: code});
      }

      setPlaylistInput(code);
    }
  }

  let listing = [];
  if (playlistPage) {
    // processes playlist entries into ones readable by SelectableList
    listing = playlistPage.items.map((entry, index) => {
      const item = {
        index: playlistPage.offset + index + 1,
        id: entry.id,
        display: entry.title,
        cover: entry.icon,
        artist: entry.artist
      }
      return item
    })
  }

  const [plScrollTop, setPlScrollTop] = useState(0);
  const [plScrollBottom, setPlScrollBottom] = useState(0);

  function handleScroll(event) {
    // The target of the event is the div that is being scrolled
    setPlScrollTop(event.target.scrollTop);
    setPlScrollTop(event.target.scrollTop + event.target.offsetHeight);
    console.log(event.target.scrollTop, "---", event.target.scrollTop + event.target.offsetHeight);
  };

  const containerRef = useRef(null);

  const scrollToBottom = () => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
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
        <div className="list-container" ref={containerRef}  onScroll={handleScroll}>
          {(list.hasNoSelections()) &&
            <div className="playlist-load-notifier">
              {[...Array(15)].map((_) => {
                return plExists
                  ? <div key={crypto.randomUUID()}>Loading Playlist...</div>
                  : <div key={crypto.randomUUID()}>Error!!</div>
                })}
            </div>
          }
          <ul id="track-selector-from-playlist" className="selectable-list">
            {
              playlistPage && 
              playlistPage.items.map((entry, index) => 
                <li
                  key={entry.id}
                  data-id={entry.id}
                  className={"selectable-list-entry" + (list.isSelected(entry.id) ? " selected" : "")}
                  onClick={(e) => {e.target instanceof HTMLElement && selectEntry(entry.id)}}
                >
                  <div className="index">{playlistPage.offset + index + 1}</div>
                  <div className="cover">
                    {(entry.icon != null && entry.icon.length != 0) &&
                      <img src={entry.icon} />
                    }
                  </div>
                  <div className="disp">
                    <p>{entry.title}</p>
                  </div>
                  <div className="artist">
                    {entry.artist}
                  </div>
                </li>
              )
            }
          </ul>
        </div>
        <div className="pagination-options">
          <button disabled={pageIndex <= 1 || list.hasNoSelections()} onClick={goToFirstPage}>{"<<"}</button>
          <button disabled={pageIndex <= 1 || list.hasNoSelections()} onClick={goToPreviousPage}>{"<"}</button>
          <input
            type="text"
            value={pageIndexInput}
            onChange={onIndexChange}
            pattern="\d+"
            onBlur={onIndexSubmit}
            onKeyDown={submitOnEnter(onIndexSubmit)}
            onSubmit={onIndexSubmit}
            disabled={list.hasNoSelections()}
          />
          <button disabled={pageIndex >= maxPages || list.hasNoSelections()} onClick={goToNextPage}>{">"}</button>
          <button disabled={pageIndex >= maxPages || list.hasNoSelections()} onClick={goToLastPage}>{">>"}</button>
        </div>
        <div className="pagination-pages-num">{maxPages} Pages</div>
      </>
      }
    </div>
  );
}

export default SelectorSection;
