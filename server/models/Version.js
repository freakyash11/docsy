import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    default: null
  },
  snapshot: {
    type: mongoose.Schema.Types.Mixed, // Storing Quill Delta object
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  triggerSource: {
    type: String,
    enum: ['manual', 'periodic', 'ai-edit', 'restore'],
    required: true
  }
}, {
  timestamps: true
});

// Indexes for fast retrieval by document and for finding the latest version number
versionSchema.index({ documentId: 1, createdAt: -1 });
versionSchema.index({ documentId: 1, versionNumber: -1 });

const Version = mongoose.model('Version', versionSchema);

export default Version;
