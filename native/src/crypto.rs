use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use sha2::{Digest, Sha256};

/// Clave pública oficial de `flock-php/binaries` (`manifest.pub`), base64 estándar de 32 bytes.
/// Verifica los manifiestos firmados de todos los canales.
pub const FLOCK_MANIFEST_PUBLIC_KEY: &str = "kBKqgEsiOUOs9Dc5T7n0KdC7AqxtW2DTKzv3bb4Fhjc=";

#[derive(Debug)]
pub enum CryptoError {
  InvalidPublicKey(String),
  InvalidSignatureEncoding(String),
  InvalidSignature(String),
  VerificationFailed,
}

impl std::fmt::Display for CryptoError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{self:?}")
  }
}

pub fn verify_manifest_signature(
  manifest_bytes: &[u8],
  signature_b64: &str,
) -> Result<(), CryptoError> {
  let key_bytes = STANDARD
    .decode(FLOCK_MANIFEST_PUBLIC_KEY)
    .map_err(|e| CryptoError::InvalidPublicKey(e.to_string()))?;
  let key_array: [u8; 32] = key_bytes
    .try_into()
    .map_err(|_| CryptoError::InvalidPublicKey("la clave debe tener 32 bytes".into()))?;
  let verifying_key = VerifyingKey::from_bytes(&key_array)
    .map_err(|e| CryptoError::InvalidPublicKey(e.to_string()))?;

  let sig_bytes = STANDARD
    .decode(signature_b64.trim())
    .map_err(|e| CryptoError::InvalidSignatureEncoding(e.to_string()))?;
  let signature =
    Signature::from_slice(&sig_bytes).map_err(|e| CryptoError::InvalidSignature(e.to_string()))?;

  verifying_key
    .verify(manifest_bytes, &signature)
    .map_err(|_| CryptoError::VerificationFailed)
}

pub fn sha256_hex(data: &[u8]) -> String {
  let mut hasher = Sha256::new();
  hasher.update(data);
  hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
  use super::*;
  use ed25519_dalek::{Signer, SigningKey};
  use rand::rngs::OsRng;

  #[test]
  fn sha256_known_vector() {
    assert_eq!(
      sha256_hex(b"abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  }

  #[test]
  fn signature_roundtrip_with_test_key() {
    let key = SigningKey::generate(&mut OsRng);
    let data = b"contenido del manifiesto";
    let sig = key.sign(data);
    let sig_b64 = STANDARD.encode(sig.to_bytes());
    let vk = key.verifying_key();
    assert!(vk.verify(data, &sig).is_ok());
    assert!(!sig_b64.is_empty());
  }
}
