import React, { useState } from 'react';
import { X, Star } from 'lucide-react';
import { submitReview } from '../lib/reviews';
import theme from '../theme';

export default function ReviewModal({ user, profile, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const displayName = profile?.name || user?.displayName || 'Anonymous';

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a star rating.'); return; }
    if (body.trim().length < 10) { setError('Please write at least 10 characters.'); return; }

    setSubmitting(true);
    setError('');
    try {
      await submitReview({
        uid: user.uid,
        name: displayName,
        location: location.trim() || 'India',
        rating,
        body: body.trim(),
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(32,26,23,0.6)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '28px 28px 0 0',
        width: '100%',
        maxWidth: '480px',
        padding: '28px 24px 40px',
        position: 'relative',
        animation: 'slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <style>{`
          @keyframes slideUpModal {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: '#E6DED9', borderRadius: 99, margin: '0 auto 20px' }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: '#F5EDE4', border: 'none', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} color="#7A6055" />
        </button>

        <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 22, fontWeight: 900, color: '#201a17', marginBottom: 4 }}>
          Rate OraNeo ✨
        </h2>
        <p style={{ fontSize: 13, color: '#7A6055', marginBottom: 24, lineHeight: 1.4 }}>
          Your feedback helps others discover us and helps us improve.
        </p>

        {/* Star Rating */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                transition: 'transform 0.15s ease',
                transform: (hoverRating || rating) >= star ? 'scale(1.2)' : 'scale(1)',
              }}
            >
              <Star
                size={36}
                fill={(hoverRating || rating) >= star ? '#8b4a30' : 'none'}
                stroke={(hoverRating || rating) >= star ? '#8b4a30' : '#D9C2BA'}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        {/* Rating label */}
        {(hoverRating || rating) > 0 && (
          <p style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#8b4a30', marginBottom: 16 }}>
            {['', 'Poor 😕', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🤩'][hoverRating || rating]}
          </p>
        )}

        {/* Location */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#7A6055', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your City (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Mumbai, Delhi, Bangalore..."
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={50}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: '1.5px solid #E6DED9', fontSize: 14, outline: 'none',
              fontFamily: 'inherit', color: '#201a17', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Review text */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#7A6055', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Your Review
          </label>
          <textarea
            placeholder="Tell us about your experience with OraNeo's AI try-on..."
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={300}
            rows={4}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12,
              border: '1.5px solid #E6DED9', fontSize: 14, outline: 'none',
              resize: 'none', fontFamily: 'inherit', color: '#201a17',
              boxSizing: 'border-box', lineHeight: 1.5,
            }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: '#B8A49A', marginTop: 4 }}>
            {body.length}/300
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFF5F5', border: '1px solid #FED7D7',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#E53E3E', fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Submitting as */}
        <p style={{ fontSize: 12, color: '#B8A49A', marginBottom: 16, textAlign: 'center' }}>
          Posting as <strong style={{ color: '#7A6055' }}>{displayName}</strong>
        </p>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '16px',
            background: submitting ? '#D9C2BA' : '#8b4a30',
            color: 'white', border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, cursor: submitting ? 'default' : 'pointer',
            transition: 'background 0.2s ease',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>
    </div>
  );
}
