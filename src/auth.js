import { invoke } from "@tauri-apps/api/core";
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

    // localStorage.removeItem("access_token");  // TODO: figure out long term token storage!!
    window.location.href = authUrl;
}

export async function triggerResponse() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (code != null) {
        // retrieve 'codeVerifier' from init_login process
        const codeVerifier = localStorage.getItem('code_verifier');
        if (codeVerifier == null) {
            return;
        }

        const value = await invoke("finish_login", {codeVerifier: codeVerifier, code: code})
            .catch(error => {
                console.log(error);
                return Promise.resolve(error);
            });
        if (value !== "err") {
            // keeping this for now but all access should be done in backend
            localStorage.setItem("access_token", value);
        }
    }
    localStorage.removeItem('code_verifier')
}

export async function getPlaylistContents() {
    
}

export async function getProfile() {
    return await invoke("get_profile");
}