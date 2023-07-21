const { features } = require("@saltcorn/data/db/state");

// user subscribe action
const actions = {
  undo_row_changes: {
    requireRow: true,
    run: async ({ table, row, user }) => {
      if (!table.versioned) return { error: "History not enabled for table" };
      await table.undo_row_changes(row.id, user);
      return { reload_page: true };
    },
  },
  redo_row_changes: {
    requireRow: true,
    run: async ({ table, row, user }) => {
      if (!table.versioned) return { error: "History not enabled for table" };
      await table.redo_row_changes(row.id, user);
      return { reload_page: true };
    },
  },
};

module.exports = {
  sc_plugin_api_version: 1,
  actions: features?.table_undo ? actions : undefined,
};
