<script setup lang="ts">
// Shared table for dashboard, comparison, statistics, and administration views.
// Columns and dynamic cell slots keep view-specific presentation outside the component.
export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

interface Props {
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  rowKey: string;
  caption: string;
  emptyMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  emptyMessage: 'No records to show.',
});
</script>

<template>
  <div class="data-table-wrapper" role="region" :aria-label="props.caption" tabindex="0">
    <table class="data-table">
      <caption class="sr-only">
        {{
          props.caption
        }}
      </caption>
      <thead>
        <tr>
          <th
            v-for="column in props.columns"
            :key="column.key"
            :class="`align-${column.align ?? 'left'}`"
            scope="col"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in props.rows" :key="String(row[props.rowKey])">
          <td
            v-for="column in props.columns"
            :key="column.key"
            :class="`align-${column.align ?? 'left'}`"
          >
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
              {{ row[column.key] }}
            </slot>
          </td>
        </tr>
        <tr v-if="props.rows.length === 0">
          <td :colspan="props.columns.length" class="empty-row">
            {{ props.emptyMessage }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table th,
.data-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th {
  color: #475569;
  font-weight: 600;
  background-color: #f8fafc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background-color: #f8fafc;
}

.align-center {
  text-align: center;
}

.align-right {
  text-align: right;
}

.empty-row {
  padding: 1.5rem 1rem;
  color: #64748b;
  text-align: center;
  white-space: normal;
}
</style>
