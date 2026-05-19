

function TextEditor() {
  return (
    <div>
      <form action="/action_page.php">
        <br /><br />
        <label htmlFor="fname">First name:</label><br />
        <textarea
          rows="10"
        ></textarea>
        <input type="submit" value="Save" />
      </form>
    </div>
  );
}

export default TextEditor;
