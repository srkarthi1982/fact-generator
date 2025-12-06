import { defineDb } from "astro:db";
import {
  FactTopics,
  Facts,
  FactRequests,
  UserFactState,
} from "./tables";

export default defineDb({
  tables: {
    FactTopics,
    Facts,
    FactRequests,
    UserFactState,
  },
});
