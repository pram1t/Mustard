# Process Model

## Trust Boundaries

```
+---------------------------------------------------------------+
|                         MAIN PROCESS                          |
|                        (FULL TRUST)                           |
|  +----------------------------------------------------------+|
|  | - Node.js runtime                                         ||
|  | - File system access                                      ||
|  | - Network requests                                        ||
|  | - @openagent/core integration                             ||
|  | - IPC handlers (transport only)                           ||
|  +----------------------------------------------------------+|
|                              |                                |
|                              | contextBridge                  |
|                              v                                |
|  +----------------------------------------------------------+|
|  |                    PRELOAD SCRIPT                         ||
|  |                    (LIMITED TRUST)                         ||
|  | - contextBridge only                                      ||
|  | - No direct Node.js access                                ||
|  | - < 15 exposed methods                                    ||
|  +----------------------------------------------------------+|
|                              |                                |
|                              | window.api                     |
|                              v                                |
|  +----------------------------------------------------------+|
|  |                    RENDERER PROCESS                       ||
|  |                    (NO TRUST)                             ||
|  | - React UI                                                ||
|  | - No Node.js                                              ||
|  | - No file system                                          ||
|  | - window.api only                                         ||
|  +----------------------------------------------------------+|
+---------------------------------------------------------------+
```

## Security Principles

1. **Principle of Least Privilege**: Each process has minimum required access
2. **Defense in Depth**: Multiple security layers (sandbox, CSP, context isolation, permission handler)
3. **Fail Secure**: Errors result in denied access, not open access
4. **Secure by Default**: All settings start restrictive; relaxation requires explicit justification
