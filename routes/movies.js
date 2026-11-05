const express = require('express');
const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every movie route needs a signed-in member

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Invalid movie id.' });

// Only these fields are ever copied from the request body
function pickMovie(body) {
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    title: s(body.title),
    genre: s(body.genre),
    director: s(body.director),
    releaseDate: s(body.releaseDate),
    rating: Number(body.rating),
  };
}

function validate(m) {
  if (!m.title || m.title.length > 150) return 'Enter a title (up to 150 characters).';
  if (!m.genre || m.genre.length > 50) return 'Enter a genre (up to 50 characters).';
  if (!m.director || m.director.length > 100) return 'Enter a director (up to 100 characters).';
  if (!m.releaseDate || Number.isNaN(Date.parse(m.releaseDate))) return 'Enter a valid release date.';
  if (!Number.isFinite(m.rating) || m.rating < 0 || m.rating > 10) return 'Rating must be between 0 and 10.';
  return null;
}

// Owner of the record, or an admin, may change or delete it
const canModify = (user, movie) => user.role === 'admin' || movie.createdBy.equals(user._id);
const out = (user, movie) => ({ ...movie.toJSON(), createdBy: undefined, canModify: canModify(user, movie) });

router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
      filter.$or = [{ title: rx }, { director: rx }];
    }
    if (typeof req.query.genre === 'string' && req.query.genre.trim()) filter.genre = req.query.genre.trim();
    const movies = await Movie.find(filter).sort({ title: 1 }).limit(500);
    res.json(movies.map((m) => out(req.user, m)));
  } catch (e) { next(e); }
});

router.get('/:id', validId, async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id).populate('createdBy', 'name');
    if (!movie) return res.status(404).json({ error: 'Movie not found.' });
    const owner = movie.createdBy;
    const json = { ...movie.toJSON(), addedBy: owner ? owner.name : 'Former member' };
    json.canModify = req.user.role === 'admin' || (owner && owner._id.equals(req.user._id));
    delete json.createdBy;
    res.json(json);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = pickMovie(req.body);
    const err = validate(data);
    if (err) return res.status(400).json({ error: err });
    const movie = await Movie.create({ ...data, createdBy: req.user._id });
    res.status(201).json(out(req.user, movie));
  } catch (e) { next(e); }
});

router.put('/:id', validId, async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found.' });
    if (!canModify(req.user, movie)) return res.status(403).json({ error: 'Only the member who added this movie, or an admin, can change it.' });
    const data = pickMovie(req.body);
    const err = validate(data);
    if (err) return res.status(400).json({ error: err });
    Object.assign(movie, data);
    await movie.save();
    res.json(out(req.user, movie));
  } catch (e) { next(e); }
});

router.delete('/:id', validId, async (req, res, next) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found.' });
    if (!canModify(req.user, movie)) return res.status(403).json({ error: 'Only the member who added this movie, or an admin, can delete it.' });
    await movie.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
