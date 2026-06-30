import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Reset DOM between tests to prevent test pollution
afterEach(cleanup);
