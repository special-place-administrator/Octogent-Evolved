with open('apps/api/src/agentStateDetection.ts', 'r', encoding='utf-8') as f:
    c = f.read()
print('PROCESSING_PATTERNS defined:', 'const PROCESSING_PATTERNS' in c)
print('PROCESSING_PATTERNS used:', 'PROCESSING_PATTERNS' in c)
# Check for the unconditional enterProcessing at the end of observeChunk
print('unconditional enterProcessing:', '\n    return this.enterProcessing(now);\n  }' in c)
print('conditional enterProcessing:', 'if (hasPatternSignal(combined, chunkStartIndex, PROCESSING_PATTERNS))' in c)
