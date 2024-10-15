const { features } = require("@saltcorn/data/db/state");
const Table = require("@saltcorn/data/models/table");

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
  restore_from_history: {
    requireRow: true,
    run: async ({ table, row, user }) => {
      if (table.provider_name !== "History for database table")
        return {
          error:
            "Only use this action on tables provided by History for database table",
        };
      const real_table = Table.findOne({ name: table.provider_cfg?.table });
      if (!real_table) return { error: "Table not found" };
      if (!real_table.versioned)
        return { error: "History not enabled for table" };
      if (row._deleted) {
        const insRow = {};
        for (const field of real_table.fields) {
          insRow[field.name] = row[field.name];
        }
        await real_table.insertRow(insRow);
        await undelete_cascaded(real_table, insRow)
      } else {
        const updRow = {};
        for (const field of real_table.fields) {
          if (!field.primary_key) updRow[field.name] = row[field.name];
        }
        await real_table.updateRow(
          updRow,
          row[real_table.pk_name],
          user,
          false,
          undefined,
          row._version
        );
      }

      return { reload_page: true };
    },
  },
};

const undelete_cascaded = async(table, row) => {
  //inbound keys with on cascade delete

}

module.exports = {
  sc_plugin_api_version: 1,
  actions: features?.table_undo ? actions : undefined,
  table_providers: require("./table-provider.js"),
  viewtemplates: [require("./diffview")],
};
