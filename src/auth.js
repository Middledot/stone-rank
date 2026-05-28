import { invoke } from "@tauri-apps/api/core";
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow, getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { call } from "./api.js"

// PKCE auth
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
    // Q: why async?
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

export async function triggerLogin() {
    // Three functions above create 'codeVerifier'
    // then encode to send
    const codeVerifier  = generateRandomString(64);
    const hashed = await sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);

    window.localStorage.setItem('code_verifier', codeVerifier);

    let authUrl = await invoke("init_login", {codeChallenge: codeChallenge});

    // https://medium.com/@Joshua_50036/implementing-oauth-in-tauri-3c12c3375e04

    // it's only ever the one port anyway..... for now
    const port = await invoke("start_response_server");

    const stop = await listen("code", triggerResponse);

    await open(authUrl);
    console.log(authUrl);

    const _authWindow = new WebviewWindow('spotify-auth', {
        url: authUrl,
        title: 'Login with Spotify',
        width: 500,
        height: 700,
        center: true,
        resizable: false,
        focus: true,
    })
}

async function triggerResponse(payload) {
    let codeVerifier = localStorage.getItem('code_verifier')

    stop();  // stop listening after receiving the event

    const token = await invoke("finish_login", {
        codeVerifier: codeVerifier,
        code: payload.payload,  // beautiful
    });

    localStorage.setItem("access_token", token);
    localStorage.removeItem('code_verifier')

    // TODO: why don't this work :(
    // const win = WebviewWindow.getByLabel('spotify-auth')
    const windows = await getAllWebviewWindows();
    const target = windows.find((w) => w.label === 'spotify-auth');
    await target?.close();
    window.location.reload();
}

export async function getPlaylistContents(offset, limit) {
    return await invoke("get_playlist_items", {offset, limit});
}

export async function getProfile() {
    return await invoke("get_profile");
}