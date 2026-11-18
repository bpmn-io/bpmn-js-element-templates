export const TemplateMenuActions = {
  update: {
    label: 'Update to version {version}',
    description: 'Moves the element to the newer version of the same template. Settings that still exist carry over.'
  },
  migrate: {
    label: 'Migrate',
    description: 'Replaces a deprecated template with its replacement, using the recipe, and reports what changed or could not carry over.'
  },
  change: {
    label: 'Change to a different template',
    description: 'Replaces the template with the one you choose. Settings with matching names carry over, and the others are removed.'
  },
  unlink: {
    label: 'Unlink and keep properties',
    description: 'Removes the link to the template. Every setting stays on the element as a plain property.'
  },
  remove: {
    label: 'Remove and drop properties',
    description: 'Removes the template and deletes the settings it set.'
  }
};
