import { Dispatch, SetStateAction, MouseEvent, useState } from 'react';

import "../compstyle/SelectableList.css";

export function useSelectableList(
  {
    multiSelect = false,
  }
) {
  const [selected, setSelected] = useState([]);

  const toggle = (id) => {
    setSelected(prev => {
      if (multiSelect) {
        let arr = new Array();
        let noadd = false;
        for (let i of prev) {
          if (i == id) {
            noadd = true;
          } else {
            arr.push(i);
          }
        }
        if (!noadd) {
          arr.push(id);
        }

        return arr;
      }

      let next = [...prev];
      if (next.includes(id)) {
        return [];
      } else {
        return [id];
      }
    });
  };

  // function onClick(e: MouseEvent) {
  //   if (!(e.target instanceof HTMLElement)) {
  //     return
  //   }

  //   if (e.target.dataset.id === undefined) {
  //     return;
  //   }

  //   if (onClickCallback === undefined) {
  //     toggle(e.target.dataset.id);
  //   }
  // }

  return {
    selected,
    toggle,
    // onClick,
    setSelected,
    hasNoSelections: () => selected.length === 0,
    isSelected: (id) => selected.includes(id),
  };
}
