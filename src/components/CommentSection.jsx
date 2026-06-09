import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import "../compstyle/CommentSection.css";
import { useLogin } from "../contexts";

function CommentSection(
  {
    selectedTrack
  }
) {
  const [comment, setComment] = useState("testing");
  const [commentInput, setCommentInput] = useState("testing");
  const [commentSaving, setCommentSaving] = useState(0);
  const [commentSavingTimeout, setCommentSavingTimeout] = useState(null);

  const isLoggedIn = useLogin();

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
    if (selectedTrack == null) {
      setComment("");
      return;
    };

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

  return (
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
          disabled={!isLoggedIn || selectedTrack == null}
        />
      </div>
    </div>
  );
}

export default CommentSection;
