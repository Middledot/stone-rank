fn main() {
    let vars = dotenvy::from_path_iter(".env")
        .expect(".env missing");

    for item in vars {
        let (key, value) = item.unwrap();
        println!("cargo:rustc-env={key}={value}");
    }

    tauri_build::build()
}
