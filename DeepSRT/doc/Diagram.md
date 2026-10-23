```mermaid
graph TB
    subgraph "Background Script"
        BS[Background Store]
        R[Reducer]
        M[Middleware]
    end

    subgraph "Content Script"
        CS[Content Store Proxy]
        CA[Content Actions]
        CL[Content Listeners]
    end

    subgraph "Sidebar"
        SS[Sidebar Store Proxy]
        SA[Sidebar Actions]
        SL[Sidebar Listeners]
    end

    subgraph "State Types"
        VD[Video Data]
        CD[Caption Data]
        UI[UI State]
        CN[Connections]
    end

    BS --> |State Updates| CS
    BS --> |State Updates| SS
    CS --> |Dispatch| BS
    SS --> |Dispatch| BS
    
    R --> |Manage| VD
    R --> |Manage| CD
    R --> |Manage| UI
    R --> |Manage| CN

    CA --> |Trigger| CS
    SA --> |Trigger| SS
    
    CL --> |Monitor| CS
    SL --> |Monitor| SS

    style BS fill:#f96,stroke:#333
    style CS fill:#9cf,stroke:#333
    style SS fill:#9cf,stroke:#333

```

I'll break down the state management architecture into three focused diagrams:

1. Core Store Architecture:
```mermaid
graph TB
    subgraph "Background Script"
        BS[Background Store]
        R[Reducer]
        M[Middleware]
    end

    subgraph "State Types"
        VD[Video Data]
        CD[Caption Data]
        UI[UI State]
        CN[Connections]
    end
    
    R --> |Manage| VD
    R --> |Manage| CD
    R --> |Manage| UI
    R --> |Manage| CN
    M --> |Process| BS
    BS --> |Update| R

    style BS fill:#f96,stroke:#333
    style R fill:#9cf,stroke:#333
    style M fill:#bfb,stroke:#333
```

2. Component Communication:
```mermaid
graph TB
    subgraph "Store Communication"
        BS[Background Store]
        CS[Content Store Proxy]
        SS[Sidebar Store Proxy]
    end

    BS --> |State Updates| CS
    BS --> |State Updates| SS
    CS --> |Dispatch| BS
    SS --> |Dispatch| BS
    
    CS --> |Sync| SS
    SS --> |Sync| CS

    style BS fill:#f96,stroke:#333
    style CS fill:#9cf,stroke:#333
    style SS fill:#9cf,stroke:#333
```

3. Action and Listener Flow:
```mermaid
graph TB
    subgraph "Action System"
        CA[Content Actions]
        SA[Sidebar Actions]
        CL[Content Listeners]
        SL[Sidebar Listeners]
        CS[Content Store]
        SS[Sidebar Store]
    end

    CA --> |Trigger| CS
    SA --> |Trigger| SS
    CL --> |Monitor| CS
    SL --> |Monitor| SS
    
    CS --> |Notify| CL
    SS --> |Notify| SL

    style CS fill:#9cf,stroke:#333
    style SS fill:#9cf,stroke:#333
    style CA fill:#f96,stroke:#333
    style SA fill:#f96,stroke:#333
```

These diagrams better illustrate:
1. The core state management structure
2. How components communicate with each other
3. The action and listener relationships within components

Each diagram focuses on a specific aspect of the architecture, making it easier to understand the different layers of the system.
