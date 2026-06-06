import Version from '../../models/Version.js';
import mongoose from 'mongoose';

const MAX_VERSIONS_PER_DOCUMENT = 100;

/**
 * @param {import('bullmq').Job} job
 */
export async function processVersionJob(job) {
  const { documentId, snapshot, triggerSource, createdBy, label } = job.data;

  console.log(
    `[versionProcessor] Processing job ${job.id} — doc: ${documentId} | source: ${triggerSource} | attempt: ${job.attemptsMade + 1}`
  );

  if (!documentId || !snapshot || !triggerSource || !createdBy) {
    throw new Error(`[versionProcessor] Job ${job.id} is missing required fields.`);
  }

  // 1. Determine the next version number
  // Using a separate query to find the latest version number
  const lastVersion = await Version.findOne({ documentId })
    .sort({ versionNumber: -1 })
    .select('versionNumber')
    .lean();

  const nextVersionNumber = lastVersion && typeof lastVersion.versionNumber === 'number' 
    ? lastVersion.versionNumber + 1 
    : 1;

  // 2. Create the new version
  const newVersion = await Version.create({
    documentId,
    versionNumber: nextVersionNumber,
    snapshot,
    triggerSource,
    createdBy,
    label: label || null
  });

  console.log(`[versionProcessor] Created version ${nextVersionNumber} for doc ${documentId}`);

  // 3. Cleanup old versions to prevent unlimited growth
  // Find versions sorted by newest first, skip the MAX, and delete the rest
  const versionsToKeep = await Version.find({ documentId })
    .sort({ createdAt: -1 })
    .skip(MAX_VERSIONS_PER_DOCUMENT)
    .select('_id')
    .lean();

  if (versionsToKeep && versionsToKeep.length > 0) {
    const idsToDelete = versionsToKeep.map(v => v._id);
    const deleteResult = await Version.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`[versionProcessor] Cleaned up ${deleteResult.deletedCount} old versions for doc ${documentId}`);
  }

  return { success: true, versionId: newVersion._id, versionNumber: nextVersionNumber };
}
