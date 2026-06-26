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
const VIRT_OFFSET = 10
const ENTRIES_PER_PAGE = 20;

function SelectorSection({ list }) {
  const isLoggedIn = useLogin();

  const [index, setIndex] = useState(1);
  const [indexInput, setIndexInput] = useState(1);

  const [playlist, setPlaylist] = useState(null);
  const [playlistInput, setPlaylistInput] = useState("");

  const [plTotal, setPlTotal] = useState(401);
  const [plName, setPlName] = useState("no playlist");

  const [loadingPlaylist, setLoadingPlaylist] = useState(true);
  const [lazyLoading, setLazyLoading] = useState([]);
  const [plExists, setPlExists] = useState(true);

  const [playlistPage, setPlaylistPage] = useState(null);
  const [totalList, setTotalList] = useState({});

  const [plScrollTop, setPlScrollTop] = useState(0);
  const [plScrollBottom, setPlScrollBottom] = useState(0);
  const scrollContainer = useRef(null);

  /**
   * [callback] when the selection list component wants to set the new entry
   * comment (comment) when comment is changed
   */
  function selectEntry(newId) {
    // https://stackoverflow.com/questions/679915/how-do-i-test-for-an-empty-javascript-object
    // TODO: this isn't a very good solution... maybe use a reducer?
    for (const prop in totalList) {
      if (Object.hasOwn(totalList, prop)) {
        list.toggle(newId);
        return;
      }
    }
    console.warn("No playlist data but entry was selected...");

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

  // ==== List Index GoTo Controls (index) ====

  /**
   * [callback] when the visual index is modified.
   */
  function onIndexChange(e) {
    if (e.target.checkValidity()) {
      setIndexInput(e.target.value);
    }
  }

  /**
   * [callback] when the visual index is submitted.
   */
  function onIndexSubmit(e) {
    // this is going to run for onSubmit and onUnblur
    if (e.target.checkValidity()) {
      const newIndex = Math.max(1, Math.min(plTotal, indexInput));
      setIndex(newIndex);
      console.info("Page index set: ", newIndex);

      scrollContainer.current?.scrollTo({
        top: (newIndex - 1) * 40,
        behavior: "instant"
      })

      // the index stays in focus if you press enter; Here we force blur
      e.target.blur();
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
   * This includes a 'page' parameter to load a particular page, a feature used
   * by the lazy loading mechanism. Along with it, this function includes checks so
   * pages aren't doubly loaded (if it's already being loaded, don't load it again).
   * 
   * TODO: this takes a really long time (2-4 seconds)
   */
  function getPlaylistContents(pg, lazy = false) {
    if (lazyLoading.includes(pg)) {
      return
    }

    if (lazy) {
      setLazyLoading([...lazyLoading, pg])
    } else {
      setLoadingPlaylist(true)
    }
    invoke("get_playlist_items", {offset: ENTRIES_PER_PAGE * (pg - 1), limit: ENTRIES_PER_PAGE})
      .then((res) => {
        if (list.hasNoSelections()) {
          if (res.items.length !== 0) {  // pre-set the selected track
            list.setSelected([res.items[0].id]);
          } else {
            list.setSelected([]);
          }
        }
        setPlaylistPage(res);

        setTotalList(oldTotal => {
          let newTotal = {...oldTotal};
          let index = res.offset + 1;
          for (let ent of res.items) {
            newTotal[index] = ent
            index += 1;
          }

          return newTotal;
        })
        setPlExists(true);
      })
      .catch((e) => {
        setPlaylistPage(null);
        list.setSelected([]);
        setPlExists(false);
        throw e;
      })
      .finally(() => {
        if (lazy) {
          setLazyLoading((lazyLoaded) => {
            // TODO: this sounds like it'd be slow.... but might be fine in this case
            let newLazy = [];
            for (let ind of lazyLoaded) {
              if (ind === pg) continue;
              // if (newLazy.includes(ind)) continue; // should never happen anyways right?
              newLazy.push(ind)
            }
            return newLazy;
          })
        } else {
          setLoadingPlaylist(false)
        }
      }
    )
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
   * [effect] updates playlist listing (uuh..) when index is changed.
   * 
   * This no longer updates the index because the index is updated by
   * `handleScroll`
   */
  useEffect(() => {
    if (isLoggedIn && playlist) {
      list.setSelected([]);
      setPlExists(true);
      getPlaylistContents(1);
      setPlaylistInput(playlist || playlistInput);
    }
  }, [isLoggedIn, playlist]);

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

  // ==== Infinite List (lazy loaded, but no virtualization) ====

  /**
   * [callback] either manually or via scroll event, update scroll parameters and
   * load new playlist pages if needed
   */
  function handleScroll() {
    let target = scrollContainer.current;
    if (target === undefined || target === null) {
      return
    }

    // save scroll for next sessions/reload
    // NOTE: MAYBE save in database but I don't immediately see why right now
    localStorage.setItem("plScrollTop", target.scrollTop.toString())

    if (target.scrollTop < 0) {
      return;
    }

    // calculate before and after index positions
    let oldLowerBoundIndex = Math.max(Math.floor(plScrollTop / 40) + 1 - VIRT_OFFSET, 0);
    let oldHigherBoundIndex = Math.min(Math.floor(plScrollBottom / 40) + 1 + VIRT_OFFSET, plTotal);
    setPlScrollTop(target.scrollTop);
    setPlScrollBottom(target.scrollTop + target.offsetHeight);

    let lowerIndex = Math.floor(target.scrollTop / 40) + 1;
    let higherIndex = Math.floor((target.scrollTop + target.offsetHeight) / 40) + 1;
    setIndex(lowerIndex);
    setIndexInput(lowerIndex);

    let newLowerBoundIndex = Math.max(lowerIndex - VIRT_OFFSET, 0);
    let newHigherBoundIndex = Math.min(higherIndex + VIRT_OFFSET, plTotal);

    // here, we decide if we want to load another page
    if (totalList[lowerIndex] === undefined) {
      let page = Math.ceil(newLowerBoundIndex / ENTRIES_PER_PAGE);
      getPlaylistContents(page, true)
    }

    if (totalList[higherIndex] === undefined) {
      let page = Math.ceil(newHigherBoundIndex / ENTRIES_PER_PAGE);
      getPlaylistContents(page, true)
    }

    if (oldLowerBoundIndex > newLowerBoundIndex) {
      if (totalList[newLowerBoundIndex] === undefined) {
        let page = Math.ceil(newLowerBoundIndex / ENTRIES_PER_PAGE);
        if (page <= 0) {
          page = 1;
        }
        getPlaylistContents(page, true)
      }
    } else if (oldHigherBoundIndex < newHigherBoundIndex) {
      if (totalList[newHigherBoundIndex] === undefined) {
        let page = Math.ceil(newHigherBoundIndex / ENTRIES_PER_PAGE);
        if (page > plTotal) {
          page = plTotal;
        }
        getPlaylistContents(page, true)
      }
    }
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
        <div className="list-container" ref={scrollContainer} onScroll={handleScroll}>
          {(list.hasNoSelections()) &&
            <div className="playlist-load-notifier">
              {[...Array(15)].map((_) => {
                return plExists
                  ? <div key={crypto.randomUUID()}>Loading Playlist...</div>
                  : <div key={crypto.randomUUID()}>Error!!</div>
                })}
            </div>
          }
          <ul
            id="track-selector-from-playlist"
            className="selectable-list"
            style={{
              height: `${plTotal * 40}px`,
              position: "relative"
            }}
          >
            {
              Object.entries(totalList).map(([ind, entry]) => 
                <li
                  key={entry.id}
                  data-id={entry.id}
                  className={"selectable-list-entry" + (list.isSelected(entry.id) ? " selected" : "")}
                  onClick={(e) => {e.target instanceof HTMLElement && selectEntry(entry.id)}}
                  style={{
                    top: `${40 * (ind - 1)}px`,
                    position: "absolute"
                  }}
                >
                  <div className="index">{ind}</div>
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
          <input
            type="text"
            value={indexInput}
            onChange={onIndexChange}
            pattern="\d+"
            onBlur={onIndexSubmit}
            onKeyDown={submitOnEnter(onIndexSubmit)}
            onSubmit={onIndexSubmit}
            disabled={list.hasNoSelections()}
          />
        </div>
      </>
      }
    </div>
  );
}

export default SelectorSection;
