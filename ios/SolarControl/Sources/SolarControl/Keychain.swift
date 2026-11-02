import Foundation
import Security
import SolarCore

/// Guarda o par access/refresh token no Keychain, nunca no UserDefaults.
final class KeychainTokenStore: TokenStore, @unchecked Sendable {
    private let service = "com.pedro.solarcontrol.auth"
    private let account = "tokens"
    private let lock = NSLock()
    private var cache: AuthTokens??

    func load() -> AuthTokens? {
        lock.lock()
        defer { lock.unlock() }
        if let cache { return cache }

        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data,
              let tokens = try? JSONDecoder().decode(AuthTokens.self, from: data)
        else {
            cache = .some(nil)
            return nil
        }
        cache = .some(tokens)
        return tokens
    }

    func save(_ tokens: AuthTokens?) {
        lock.lock()
        defer { lock.unlock() }
        cache = .some(tokens)

        SecItemDelete(baseQuery() as CFDictionary)
        guard let tokens, let data = try? JSONEncoder().encode(tokens) else { return }

        var query = baseQuery()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
