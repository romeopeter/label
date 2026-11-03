//! Free image search, through Pixabay.
//!
//! This lives in Rust so the API key never reaches the webview. Errors are
//! deliberately plain values: an HTTP client's own errors include the request
//! URL, and this request's URL contains the key.

use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

use reqwest::{Client, StatusCode, Url, redirect::Policy};
use serde::{Deserialize, Serialize};
use tauri::{State, ipc::Response};

const API_KEY: Option<&str> = option_env!("LAYER_PIXABAY_KEY");
const SEARCH_URL: &str = "https://pixabay.com/api/";

/// Pixabay's limit.
const MAX_QUERY_CHARS: usize = 100;
const PER_PAGE: u32 = 30;
const SEARCH_TIMEOUT: Duration = Duration::from_secs(15);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);

/// Pixabay's API terms require caching requests for 24 hours.
const CACHE_LIFETIME: Duration = Duration::from_secs(24 * 60 * 60);
const CACHE_ENTRIES: usize = 128;

/// Largest images here are 1280 px, so this only stops a surprise response.
const MAX_IMAGE_BYTES: usize = 50 * 1024 * 1024;

const IMAGE_HOSTS: [&str; 2] = ["pixabay.com", "cdn.pixabay.com"];

#[derive(Debug, thiserror::Error)]
enum PixabayError {
    #[error("Image search isn't set up in this version of Layer.")]
    NoKey,
    #[error("Too many searches right now. Try again in a minute.")]
    RateLimited,
    #[error("Layer couldn't reach Pixabay. Check your connection and try again.")]
    Unreachable,
    #[error("Pixabay sent something Layer can't use. Try again in a moment.")]
    BadResponse,
    #[error("Layer can't download an image from there.")]
    UntrustedUrl,
    #[error("This image is too large to add.")]
    TooLarge,
}

#[derive(Deserialize)]
struct ApiPage {
    #[serde(rename = "totalHits")]
    total_hits: u64,
    hits: Vec<ApiHit>,
}

#[derive(Deserialize)]
struct ApiHit {
    id: u64,
    tags: String,
    #[serde(rename = "previewURL")]
    preview_url: String,
    #[serde(rename = "largeImageURL")]
    large_image_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockImage {
    id: u64,
    tags: String,
    preview_url: String,
    large_image_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockPage {
    images: Vec<StockImage>,
    has_more: bool,
}

impl StockPage {
    fn from_api(api: ApiPage, page: u32) -> Self {
        Self {
            has_more: u64::from(page) * u64::from(PER_PAGE) < api.total_hits,
            images: api
                .hits
                .into_iter()
                .map(|hit| StockImage {
                    id: hit.id,
                    tags: hit.tags,
                    preview_url: hit.preview_url,
                    large_image_url: hit.large_image_url,
                })
                .collect(),
        }
    }
}

type CacheKey = (String, u32);

/// In memory for now, so it starts empty on launch: SQLite is still deferred.
#[derive(Default)]
pub struct SearchCache(Mutex<HashMap<CacheKey, (Instant, StockPage)>>);

impl SearchCache {
    fn get(&self, key: &CacheKey, now: Instant) -> Option<StockPage> {
        let entries = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let (stored, page) = entries.get(key)?;
        (now.duration_since(*stored) < CACHE_LIFETIME).then(|| page.clone())
    }

    fn put(&self, key: CacheKey, page: StockPage, now: Instant) {
        let mut entries = self.0.lock().unwrap_or_else(|e| e.into_inner());
        entries.retain(|_, (stored, _)| now.duration_since(*stored) < CACHE_LIFETIME);
        if entries.len() >= CACHE_ENTRIES
            && let Some(oldest) = entries
                .iter()
                .min_by_key(|(_, (stored, _))| *stored)
                .map(|(key, _)| key.clone())
        {
            entries.remove(&oldest);
        }
        entries.insert(key, (now, page));
    }
}

/// The form a search is cached under, and sent as.
fn normalize_query(query: &str) -> String {
    query
        .trim()
        .chars()
        .take(MAX_QUERY_CHARS)
        .collect::<String>()
        .to_lowercase()
}

/// The UI names what to download, so only Pixabay's own image hosts are allowed.
fn image_url(raw: &str) -> Result<Url, PixabayError> {
    let url = Url::parse(raw).map_err(|_| PixabayError::UntrustedUrl)?;
    let trusted = url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && url
            .host_str()
            .is_some_and(|host| IMAGE_HOSTS.contains(&host));
    if trusted {
        Ok(url)
    } else {
        Err(PixabayError::UntrustedUrl)
    }
}

/// No redirects: one could leave the hosts `image_url` allows, or carry the key.
fn client(timeout: Duration) -> Result<Client, PixabayError> {
    Client::builder()
        .timeout(timeout)
        .redirect(Policy::none())
        .build()
        .map_err(|_| PixabayError::Unreachable)
}

fn check_status(status: StatusCode) -> Result<(), PixabayError> {
    match status {
        StatusCode::TOO_MANY_REQUESTS => Err(PixabayError::RateLimited),
        status if status.is_success() => Ok(()),
        _ => Err(PixabayError::BadResponse),
    }
}

async fn fetch_page(query: &str, page: u32) -> Result<StockPage, PixabayError> {
    let key = API_KEY.ok_or(PixabayError::NoKey)?;
    let response = client(SEARCH_TIMEOUT)?
        .get(SEARCH_URL)
        .query(&[
            ("key", key),
            ("q", query),
            ("safesearch", "true"),
            ("page", &page.to_string()),
            ("per_page", &PER_PAGE.to_string()),
        ])
        .send()
        .await
        .map_err(|_| PixabayError::Unreachable)?;
    check_status(response.status())?;

    let body = response
        .bytes()
        .await
        .map_err(|_| PixabayError::Unreachable)?;
    let api: ApiPage = serde_json::from_slice(&body).map_err(|_| PixabayError::BadResponse)?;
    Ok(StockPage::from_api(api, page))
}

async fn fetch_image(url: Url) -> Result<Vec<u8>, PixabayError> {
    let mut response = client(DOWNLOAD_TIMEOUT)?
        .get(url)
        .send()
        .await
        .map_err(|_| PixabayError::Unreachable)?;
    check_status(response.status())?;

    let is_image = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("image/"));
    if !is_image {
        return Err(PixabayError::BadResponse);
    }

    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| PixabayError::Unreachable)?
    {
        if bytes.len() + chunk.len() > MAX_IMAGE_BYTES {
            return Err(PixabayError::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn search_images(
    cache: State<'_, SearchCache>,
    query: String,
    page: u32,
) -> Result<StockPage, String> {
    let query = normalize_query(&query);
    let page = page.max(1);
    if query.is_empty() {
        return Ok(StockPage {
            images: Vec::new(),
            has_more: false,
        });
    }

    let key = (query, page);
    if let Some(cached) = cache.get(&key, Instant::now()) {
        return Ok(cached);
    }
    let result = fetch_page(&key.0, page)
        .await
        .map_err(|error| error.to_string())?;
    cache.put(key, result.clone(), Instant::now());
    Ok(result)
}

/// Downloaded rather than linked: Pixabay's terms don't allow keeping its URLs in
/// a project. Raw bytes, because a JSON-encoded image would be slow over IPC.
#[tauri::command]
pub async fn download_image(url: String) -> Result<Response, String> {
    let url = image_url(&url).map_err(|error| error.to_string())?;
    fetch_image(url)
        .await
        .map(Response::new)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn stock_page() -> StockPage {
        StockPage {
            images: Vec::new(),
            has_more: false,
        }
    }

    #[test]
    fn image_url_allows_only_pixabay_over_https() {
        for good in [
            "https://pixabay.com/get/abc_1280.jpg",
            "https://cdn.pixabay.com/photo/a_150.jpg",
        ] {
            assert!(image_url(good).is_ok(), "{good}");
        }
        for bad in [
            "http://pixabay.com/get/a.jpg",
            "https://pixabay.com.evil.test/a.jpg",
            "https://evil.test/pixabay.com/a.jpg",
            "https://pixabay.com@evil.test/a.jpg",
            "https://user@pixabay.com/a.jpg",
            "https://pixabay.com:8443/a.jpg",
            "https://127.0.0.1/a.jpg",
            "file:///etc/passwd",
            "not a url",
        ] {
            assert!(image_url(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn normalize_query_trims_lowers_and_caps() {
        assert_eq!(normalize_query("  Yellow Flower "), "yellow flower");
        assert_eq!(normalize_query(&"a".repeat(150)).chars().count(), 100);
        assert_eq!(normalize_query(&"é".repeat(150)).chars().count(), 100);
    }

    #[test]
    fn parses_a_response_with_unknown_fields() {
        let body = r#"{"total":9,"totalHits":31,"newField":1,"hits":[{"id":7,"tags":"sky","previewURL":"https://cdn.pixabay.com/p_150.jpg","largeImageURL":"https://pixabay.com/get/l_1280.jpg","views":3}]}"#;
        let api: ApiPage = serde_json::from_str(body).expect("parses");

        let first = StockPage::from_api(api, 1);

        assert!(first.has_more);
        assert_eq!(first.images[0].id, 7);
        assert_eq!(
            first.images[0].large_image_url,
            "https://pixabay.com/get/l_1280.jpg"
        );
    }

    #[test]
    fn last_page_has_no_more() {
        let api = ApiPage {
            total_hits: 60,
            hits: Vec::new(),
        };
        assert!(!StockPage::from_api(api, 2).has_more);
    }

    #[test]
    fn status_maps_to_the_right_error() {
        assert!(check_status(StatusCode::OK).is_ok());
        assert!(matches!(
            check_status(StatusCode::TOO_MANY_REQUESTS),
            Err(PixabayError::RateLimited)
        ));
        assert!(matches!(
            check_status(StatusCode::BAD_REQUEST),
            Err(PixabayError::BadResponse)
        ));
    }

    #[test]
    fn cache_hits_within_a_day_and_misses_after() {
        let cache = SearchCache::default();
        let key = ("sky".to_owned(), 1);
        let now = Instant::now();
        cache.put(key.clone(), stock_page(), now);

        assert!(cache.get(&key, now + CACHE_LIFETIME / 2).is_some());
        assert!(cache.get(&key, now + CACHE_LIFETIME).is_none());
    }

    #[test]
    fn cache_stays_bounded_and_drops_the_oldest() {
        let cache = SearchCache::default();
        let now = Instant::now();
        for i in 0..=CACHE_ENTRIES {
            let at = now + Duration::from_secs(i as u64);
            cache.put((format!("q{i}"), 1), stock_page(), at);
        }
        let later = now + Duration::from_secs(CACHE_ENTRIES as u64);

        assert!(cache.get(&("q0".to_owned(), 1), later).is_none());
        assert!(
            cache
                .get(&(format!("q{CACHE_ENTRIES}"), 1), later)
                .is_some()
        );
    }

    /// Calls the real service with the real key:
    /// `cargo test --all-features -- --ignored real_pixabay`
    #[tokio::test]
    #[ignore = "needs the network and an API key"]
    async fn real_pixabay_search_and_download() {
        let key = API_KEY.expect("key in the build");

        let found = fetch_page("yellow flower", 1).await.expect("search works");
        assert!(!found.images.is_empty());
        assert!(found.has_more);

        let json = serde_json::to_string(&found).expect("serializes");
        assert!(!json.contains(key), "the key must never reach the webview");

        let first = &found.images[0];
        println!("preview: {}", first.preview_url);
        let url = image_url(&first.large_image_url).expect("trusted host");
        let bytes = fetch_image(url).await.expect("download works");
        assert!(bytes.len() > 1000);
        image_url(&first.preview_url).expect("preview is a trusted host");
    }
}
