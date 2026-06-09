import "../compstyle/PreviewSection.css";

function PreviewSection(
  {
    selectedTrack
  }
) {
  return (
    <div className="integrated-player">
      {/* <h2 className="section-title">Spotify Player</h2> */}
      {/* <button id="togglePlay" onClick={onPlayToggle}>Toggle Play</button> */}
      <iframe style={{border: "none", }} src={`https://open.spotify.com/embed/track/${selectedTrack}?utm_source=generator`} width="100%" height="100%" frameBorder="0" allowFullScreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
    </div>
  );
}

export default PreviewSection;
