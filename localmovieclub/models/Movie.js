const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    genre: { type: String, required: true, trim: true, maxlength: 50 },
    releaseDate: { type: Date, required: true },
    rating: { type: Number, required: true, min: 0, max: 10 },
    director: { type: String, required: true, trim: true, maxlength: 100 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

movieSchema.virtual('year').get(function () {
  return this.releaseDate ? this.releaseDate.getUTCFullYear() : null;
});
movieSchema.set('toJSON', { virtuals: true, versionKey: false, transform: (_d, r) => { delete r.id; return r; } });
movieSchema.index({ title: 1 });

module.exports = mongoose.model('Movie', movieSchema);
