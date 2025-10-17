# Test Mermaid Diagram

This is a test flowchart for CollabCanvas Mermaid import.

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Success!]
    B -->|No| D[Debug]
    D --> A
    C --> E([End])
    
    F[[Initialize System]] --> A
    G[(Database)] --> F
```

## Features Tested:
- Rectangle nodes [text]
- Decision diamonds {text}
- Stadium nodes ([text])
- Rounded rectangles [[text]]
- Cylinder (database) [(text)]
- Connections with labels
- Multiple paths

