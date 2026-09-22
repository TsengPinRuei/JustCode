// The generated workspace has no dependency manager. Keep one JSON codec for all
// supported Java types so strings, nulls, arrays and lists share escaping rules.
// String.raw preserves Java escape sequences when this fragment is inserted into Runner.java.
export const JAVA_JSON_SUPPORT = String.raw`
    @SuppressWarnings("unchecked")
    static Map<String, Object> parseJson(String json) {
        JsonParser parser = new JsonParser(json);
        Object value = parser.readValue();
        parser.skipWhitespace();
        if (parser.index != json.length() || !(value instanceof Map)) {
            throw new IllegalArgumentException("Expected a JSON object");
        }
        return (Map<String, Object>) value;
    }

    static final class JsonParser {
        final String json;
        int index;

        JsonParser(String json) { this.json = json; }

        void skipWhitespace() {
            while (index < json.length() && Character.isWhitespace(json.charAt(index))) index++;
        }

        void expect(char expected) {
            skipWhitespace();
            if (index >= json.length() || json.charAt(index++) != expected) {
                throw new IllegalArgumentException("Invalid JSON at index " + index);
            }
        }

        boolean consume(char value) {
            skipWhitespace();
            if (index < json.length() && json.charAt(index) == value) {
                index++;
                return true;
            }
            return false;
        }

        Object readValue() {
            skipWhitespace();
            if (index >= json.length()) throw new IllegalArgumentException("Unexpected end of JSON");
            char next = json.charAt(index);
            if (next == '"') return readString();
            if (next == '{') {
                index++;
                Map<String, Object> object = new LinkedHashMap<>();
                if (consume('}')) return object;
                do {
                    skipWhitespace();
                    String key = readString();
                    expect(':');
                    object.put(key, readValue());
                } while (consume(','));
                expect('}');
                return object;
            }
            if (next == '[') {
                index++;
                List<Object> array = new ArrayList<>();
                if (consume(']')) return array;
                do { array.add(readValue()); } while (consume(','));
                expect(']');
                return array;
            }
            if (json.startsWith("true", index)) { index += 4; return true; }
            if (json.startsWith("false", index)) { index += 5; return false; }
            if (json.startsWith("null", index)) { index += 4; return null; }
            int start = index;
            while (index < json.length() && "-+0123456789.eE".indexOf(json.charAt(index)) >= 0) index++;
            String number = json.substring(start, index);
            // Keep integral values as Long so they are not rounded through Double before conversion.
            if (number.indexOf('.') >= 0 || number.indexOf('e') >= 0 || number.indexOf('E') >= 0) {
                return Double.valueOf(number);
            }
            return Long.valueOf(number);
        }

        String readString() {
            expect('"');
            StringBuilder value = new StringBuilder();
            while (index < json.length()) {
                char ch = json.charAt(index++);
                if (ch == '"') return value.toString();
                if (ch != '\\') {
                    if (ch < 32) throw new IllegalArgumentException("Unescaped control character");
                    value.append(ch);
                    continue;
                }
                if (index >= json.length()) break;
                char escaped = json.charAt(index++);
                switch (escaped) {
                    case '"': case '\\': case '/': value.append(escaped); break;
                    case 'b': value.append('\b'); break;
                    case 'f': value.append('\f'); break;
                    case 'n': value.append('\n'); break;
                    case 'r': value.append('\r'); break;
                    case 't': value.append('\t'); break;
                    case 'u':
                        if (index + 4 > json.length()) throw new IllegalArgumentException("Incomplete Unicode escape");
                        value.append((char) Integer.parseInt(json.substring(index, index + 4), 16));
                        index += 4;
                        break;
                    default: throw new IllegalArgumentException("Invalid JSON escape");
                }
            }
            throw new IllegalArgumentException("Unterminated JSON string");
        }
    }

    static String toJson(Object value) {
        StringBuilder output = new StringBuilder();
        appendJson(output, value);
        return output.toString();
    }

    static void appendJson(StringBuilder output, Object value) {
        if (value == null) { output.append("null"); return; }
        if (value instanceof String || value instanceof Character) {
            appendJsonString(output, value.toString());
        } else if (value instanceof Number) {
            if ((value instanceof Double || value instanceof Float) && !Double.isFinite(((Number) value).doubleValue())) {
                throw new IllegalArgumentException("Non-finite numbers are not JSON values");
            }
            output.append(value);
        } else if (value instanceof Boolean) {
            output.append(value);
        } else if (value.getClass().isArray()) {
            output.append('[');
            int length = java.lang.reflect.Array.getLength(value);
            for (int i = 0; i < length; i++) {
                if (i > 0) output.append(',');
                appendJson(output, java.lang.reflect.Array.get(value, i));
            }
            output.append(']');
        } else if (value instanceof Iterable) {
            output.append('[');
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) output.append(',');
                appendJson(output, item);
                first = false;
            }
            output.append(']');
        } else {
            throw new IllegalArgumentException("Unsupported result type: " + value.getClass().getName());
        }
    }

    static void appendJsonString(StringBuilder output, String value) {
        output.append('"');
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '"': output.append("\\\""); break;
                case '\\': output.append("\\\\"); break;
                case '\b': output.append("\\b"); break;
                case '\f': output.append("\\f"); break;
                case '\n': output.append("\\n"); break;
                case '\r': output.append("\\r"); break;
                case '\t': output.append("\\t"); break;
                default:
                    if (ch < 32 || Character.isSurrogate(ch)) {
                        // Escaping surrogate code units also preserves unpaired JSON surrogates.
                        String hex = Integer.toHexString(ch);
                        output.append("\\u");
                        for (int padding = hex.length(); padding < 4; padding++) output.append('0');
                        output.append(hex);
                    } else output.append(ch);
            }
        }
        output.append('"');
    }
`;
