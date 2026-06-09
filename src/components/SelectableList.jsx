import { Dispatch, SetStateAction, MouseEvent } from 'react';

import "../compstyle/SelectableList.css";

// type IDType = number | string;

/** if you want
 * - Modes (multi select, single select, mixed)
 * 
 */

function SLItem(
  {
    i,
    selected,
    multiSelect,
    onClick
  }
) {
  let classList;
  if (selected == i.id) {
    classList = "selectable-list-entry selected"
  } else if (multiSelect.includes(i.id)) {
    classList = "selectable-list-entry multi-selected"
  } else {
    classList = "selectable-list-entry"
  }

  // index
  return (
    <li data-id={i.id} className={classList} onClick={onClick}>
      <div className="index">{i.index}</div>
      <div className="cover">
        {(i.cover != null && i.cover.length != 0) &&
          <img src={i.cover} />
        }
      </div>
      <div className="disp">
        <p>{i.display}</p>
      </div>
      <div className="artist">
        {i.artist}
      </div>
    </li>
  );
}


function SelectableList(
  {
    id,
    select,
    setSelect,
    multiSelect,
    setMultiSelect,
    items
  }
) {
  function elementClicked(event) {
    if (event.target instanceof HTMLElement) {
      let target = event.target;
      let uid;
      for (let i = 0; i < 5; i++) {
        if (target.dataset.id === undefined) {
          target = target.parentElement;
          if (target == null) {
            break;
          }
        } else {
          uid = target.dataset.id;
          break;
        }
      }

      // && trueTarget.parentElement != null
      if (target.tagName === 'LI') {
        if (uid !== undefined) {
          setSelect(uid);

          // TODO: code below is for multi select
          // is there a better way to do this?
          // let copy = [...multiSelect];

          // if (multiSelect.includes(id)) {
          //   const index = copy.indexOf(id);
          //   if (index > -1) { // only splice array when item is found
          //     copy.splice(index, 1); // 2nd parameter means remove one item only
          //     setMultiSelect(copy);
          //   }
          // } else {
          //   copy.push(id);
          //   setMultiSelect(copy);
          // }
        } else {
          console.warn("undefined id received in click command")
        }
      }
    }
  }

  return (
    <ul id={id} className="selectable-list">
      {items.map((i) => {
        return (
          <SLItem key={i.id} i={i} selected={select} multiSelect={multiSelect} onClick={elementClicked} />
        );
      })}
    </ul>
  );
}

export default SelectableList;
