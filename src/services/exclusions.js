import { minimatch } from 'minimatch';
import { getAllExclusions, getExclusionsByLibrary } from '../db/queries.js';

/**
 * Check if a file path is excluded based on exclusion rules
 */
export function isExcluded(filePath, libraryId) {
  const exclusions = getExclusionsByLibrary(libraryId);

  for (const exclusion of exclusions) {
    // Check if exclusion applies (global or matching library)
    if (exclusion.library_id !== null && exclusion.library_id !== libraryId) {
      continue;
    }

    if (exclusion.type === 'folder') {
      // Exact folder match - file path starts with exclusion pattern
      if (filePath.startsWith(exclusion.pattern)) {
        return {
          excluded: true,
          reason: exclusion.reason || `Matches folder exclusion: ${exclusion.pattern}`,
          pattern: exclusion.pattern,
          exclusionId: exclusion.id,
        };
      }
    } else if (exclusion.type === 'pattern') {
      // Glob pattern match using minimatch
      if (minimatch(filePath, exclusion.pattern, { matchBase: true })) {
        return {
          excluded: true,
          reason: exclusion.reason || `Matches pattern exclusion: ${exclusion.pattern}`,
          pattern: exclusion.pattern,
          exclusionId: exclusion.id,
        };
      }
    }
  }

  return { excluded: false };
}

/**
 * Check if a path would be excluded (for testing/preview)
 */
export function checkPathExclusion(filePath, libraryId = null) {
  const exclusions = libraryId ? getExclusionsByLibrary(libraryId) : getAllExclusions();
  const matches = [];

  for (const exclusion of exclusions) {
    let isMatch = false;

    if (exclusion.type === 'folder') {
      isMatch = filePath.startsWith(exclusion.pattern);
    } else if (exclusion.type === 'pattern') {
      isMatch = minimatch(filePath, exclusion.pattern, { matchBase: true });
    }

    if (isMatch) {
      matches.push({
        exclusionId: exclusion.id,
        pattern: exclusion.pattern,
        type: exclusion.type,
        reason: exclusion.reason,
        libraryId: exclusion.library_id,
      });
    }
  }

  return {
    excluded: matches.length > 0,
    matches,
  };
}

export default { isExcluded, checkPathExclusion };
