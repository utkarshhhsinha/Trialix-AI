import React, { useState, useEffect } from 'react';
import { subscribeCommunityFeed, togglePostLike, subscribePostComments, addPostComment, subscribeUserLikes, subscribeUserProfile } from '../lib/community';
import { firebaseAuth } from '../lib/firebase';
import theme from '../theme';
import { Heart, MessageCircle, Share2, Sparkles, Send, X, MoreHorizontal, Download, ExternalLink } from 'lucide-react';
import { shareTryOnWhatsApp } from '../lib/socialActions';

const APP_DOWNLOAD_URL = 'https://expo.dev/accounts/ascendras-organization/projects/tryme/builds/c67c614b-a2f8-4a17-aad9-71acb0169425';
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APP_DOWNLOAD_URL)}`;

export default function Community({ onOpenTrialRoom }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState({});
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [profile, setProfile] = useState(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  const user = firebaseAuth?.currentUser;

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeUserProfile(user.uid, setProfile);
    return () => unsub?.();
  }, [user]);

  useEffect(() => {
    const unsub = subscribeCommunityFeed(
      posts => { setFeed(posts); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!user) { setLikedPosts({}); return; }
    const unsub = subscribeUserLikes(user.uid, setLikedPosts);
    return () => unsub?.();
  }, [user]);

  useEffect(() => {
    if (!activePost?.id) { setComments([]); return; }
    const unsub = subscribePostComments(activePost.id, list => setComments(list));
    return () => unsub?.();
  }, [activePost?.id]);

  const handleLike = async (post) => {
    if (!user) return alert('Please sign in to like posts.');
    await togglePostLike(post.id, user.uid);
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !activePost || !user) return;
    await addPostComment(activePost.id, {
      userId: user.uid,
      userName: user.displayName || `@user_${user.uid.slice(0, 4)}`,
      text: commentText
    });
    setCommentText('');
  };

  // Build real stories from the live feed
  const storyUsers = (() => {
    const seen = new Set();
    const stories = [];
    if (user && profile) {
      seen.add(user.uid);
      stories.push({ userId: user.uid, username: profile.name || 'You', photoUrl: profile.basePhotoUrl || user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80', isMe: true });
    }
    for (const post of feed) {
      if (post.userId && !seen.has(post.userId)) {
        seen.add(post.userId);
        stories.push({ userId: post.userId, username: post.userName || '@user', photoUrl: post.userPhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80', isMe: false });
      }
      if (stories.length >= 10) break;
    }
    return stories;
  })();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white' }}>
        <Sparkles size={36} color={theme.colors.primary} style={{ animation: 'spin 2s linear infinite', marginBottom: 12 }} />
        <p>Loading Live Feed…</p>
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', background: '#000', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h3>No community posts yet!</h3>
        <p style={{ color: '#888', marginTop: 8 }}>Be the first to share your AI try-on look.</p>
      </div>
    );
  }

  // DESKTOP
  if (isDesktop) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', background: '#000', overflowY: 'auto' }}>
        <div className="desktop-grid">
          {/* Center Feed */}
          <div className="feed-column">
            {/* Stories Row — real users from feed */}
            <div className="stories-container">
              {storyUsers.map((story, idx) => (
                <div key={story.userId || idx} className="story-item">
                  <div className="story-ring" style={{ borderColor: story.isMe ? theme.colors.primary : 'transparent', background: story.isMe ? 'none' : 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
                    <img src={story.photoUrl} className="story-avatar" alt={story.username} />
                  </div>
                  <span className="story-username">
                    {story.isMe ? 'Your Story' : story.username.replace('@', '').slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>

            {/* Feed Posts */}
            {feed.map(post => {
              const isLiked = !!likedPosts[post.id];
              return (
                <article key={post.id} className="instagram-post">
                  <div className="post-header">
                    <div className="post-header-user">
                      <img src={post.userPhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'} className="post-user-avatar" alt={post.userName} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: 'white' }}>{post.userName}</span>
                          <span style={{ color: '#a8a8a8', fontSize: '12px' }}>• 1 h</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#a8a8a8', display: 'block' }}>{post.brand || 'TrialX AI'}</span>
                      </div>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><MoreHorizontal size={20} /></button>
                  </div>
                  <div className="post-media-container">
                    <img src={post.resultImageUrl || post.tryOnImageUrl || post.garmentImageUrl} className="post-media" alt={post.caption} />
                  </div>
                  <div className="post-actions">
                    <div className="post-actions-left">
                      <button className="post-action-btn" onClick={() => handleLike(post)}>
                        <Heart size={24} color={isLiked ? '#FF3B30' : 'white'} fill={isLiked ? '#FF3B30' : 'none'} />
                      </button>
                      <button className="post-action-btn" onClick={() => setActivePost(post)}><MessageCircle size={24} color="white" /></button>
                      <button className="post-action-btn" onClick={() => shareTryOnWhatsApp({ imageUrl: post.resultImageUrl || post.tryOnImageUrl, title: post.garmentDesc, brand: post.brand, userName: post.userName })}><Share2 size={22} color="white" /></button>
                    </div>
                    <button className="btn-primary" onClick={() => onOpenTrialRoom?.({ title: post.garmentDesc || post.title, imageUrl: post.garmentImageUrl || post.productImageUrl || post.resultImageUrl })} style={{ padding: '6px 14px', borderRadius: '12px', fontSize: '12px' }}>Try On</button>
                  </div>
                  <div className="post-details">
                    <div className="post-likes-count">{Math.max(0, post.likes || 0)} likes</div>
                    <div className="post-caption">
                      <span className="post-caption-user">{post.userName}</span>
                      {post.caption || `Styled "${post.garmentDesc || 'Outfit'}" with TrialX AI`}
                    </div>
                    {post.commentsCount > 0 && (
                      <button onClick={() => setActivePost(post)} style={{ background: 'none', border: 'none', color: '#a8a8a8', fontSize: '13px', padding: 0, marginTop: '8px', cursor: 'pointer' }}>
                        View all {post.commentsCount} comments
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* RIGHT SIDEBAR — App Download + Active Users */}
          <div className="suggestions-sidebar">
            {/* Logged-in user info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <img src={profile?.basePhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} alt="My Profile" />
              <div>
                <span style={{ fontWeight: '700', fontSize: '14px', color: 'white', display: 'block' }}>{profile?.name || user?.displayName || 'My Profile'}</span>
                <span style={{ fontSize: '12px', color: '#a8a8a8' }}>{profile?.rank || 'Style Explorer'} · ✨{profile?.auraPoints || 0} pts</span>
              </div>
            </div>

            {/* App Download Card */}
            <div style={{ background: 'linear-gradient(160deg,#1A1A1A,#0D0D0D)', borderRadius: '20px', border: '1px solid rgba(196,120,90,0.25)', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '14px', background: `linear-gradient(135deg,${theme.colors.primary},#D4815A)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 6px 18px rgba(196,120,90,0.35)' }}>
                <Download size={24} color="white" />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: '900', color: 'white', fontFamily: 'Outfit,sans-serif', marginBottom: '4px' }}>Get the TrialX AI App</h3>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px', lineHeight: 1.4 }}>Try on any outfit with your photo. Available on Android & iOS.</p>
              <div style={{ background: '#111', borderRadius: '14px', padding: '10px', border: '1px solid rgba(196,120,90,0.2)', display: 'inline-block', marginBottom: '14px' }}>
                <img src={QR_URL} alt="Download QR" width={130} height={130} style={{ display: 'block', borderRadius: '8px' }}
                  onError={e => { e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APP_DOWNLOAD_URL)}`; }} />
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>Scan to download</p>
              <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '11px', borderRadius: '14px', fontSize: '13px', fontWeight: '800', background: `linear-gradient(135deg,${theme.colors.primary},#D4815A)`, color: 'white', textDecoration: 'none', boxShadow: '0 6px 18px rgba(196,120,90,0.3)' }}>
                <ExternalLink size={14} /> Download Free
              </a>
            </div>

            {/* Active users from real feed */}
            {storyUsers.filter(s => !s.isMe).length > 0 && (
              <div>
                <span style={{ color: '#a8a8a8', fontWeight: '700', fontSize: '13px', display: 'block', marginBottom: '12px' }}>Active on TrialX</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {storyUsers.filter(s => !s.isMe).slice(0, 5).map((sug, idx) => (
                    <div key={sug.userId || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={sug.photoUrl} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} alt={sug.username} />
                      <div>
                        <span style={{ fontWeight: '700', fontSize: '13px', color: 'white', display: 'block' }}>{sug.username}</span>
                        <span style={{ fontSize: '11px', color: '#a8a8a8' }}>Shared a look</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ color: '#737373', fontSize: '11px', marginTop: '24px', lineHeight: '1.6' }}>
              About · Help · Privacy · Terms
              <div style={{ marginTop: '8px' }}>© 2026 TRIALIX AI</div>
            </div>
          </div>
        </div>
        {activePost && renderCommentsModal()}
      </div>
    );
  }

  // MOBILE — scroll-snap feed + app download last slide
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', overflowY: 'scroll', scrollSnapType: 'y mandatory', position: 'relative' }}>
      {feed.map(post => {
        const isLiked = !!likedPosts[post.id];
        return (
          <div key={post.id} style={{ position: 'relative', width: '100%', height: '100vh', scrollSnapAlign: 'start', scrollSnapStop: 'always', overflow: 'hidden' }}>
            <img src={post.resultImageUrl || post.tryOnImageUrl || post.garmentImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)', padding: '20px 16px', color: 'white', zIndex: 10 }}>
              <h1 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '26px', fontWeight: '900' }}>Community Feed</h1>
              <p style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>Live AI Fits · Scroll ⬇️</p>
            </div>
            <div style={{ position: 'absolute', right: 16, bottom: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', color: 'white', zIndex: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', border: '2px solid white', overflow: 'hidden' }}>
                <img src={post.userPhotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <button onClick={() => handleLike(post)} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Heart size={24} color={isLiked ? '#FF3B30' : 'white'} fill={isLiked ? '#FF3B30' : 'none'} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>{Math.max(0, post.likes || 0)}</span>
              </button>
              <button onClick={() => setActivePost(post)} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={24} color="white" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>{post.commentsCount || 0}</span>
              </button>
              <button onClick={() => shareTryOnWhatsApp({ imageUrl: post.resultImageUrl || post.tryOnImageUrl, title: post.garmentDesc, brand: post.brand, userName: post.userName })} style={{ background: 'none', border: 'none', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Share2 size={22} color="white" />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700' }}>Share</span>
              </button>
            </div>
            <div style={{ position: 'absolute', bottom: 85, left: 16, right: 16, color: 'white', zIndex: 20 }}>
              <div style={{ marginBottom: '14px', maxWidth: '80%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '900' }}>{post.userName || 'Fashionista'}</span>
                  <span style={{ background: 'rgba(196,120,90,0.6)', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>{post.rank || 'STYLE PRO'}</span>
                </div>
                <p style={{ fontSize: '14px', lineHeight: 1.35, textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>{post.caption || `Styled "${post.garmentDesc || 'Outfit'}" with TrialX AI`}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderRadius: '24px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: theme.colors.text, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={post.garmentImageUrl || post.productImageUrl || post.resultImageUrl} style={{ width: 44, height: 44, borderRadius: '12px', objectFit: 'cover' }} />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: '900', lineHeight: 1.2 }}>{post.garmentDesc || post.title || 'Outfit'}</h4>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' }}>{post.brand || 'TrialX'}</span>
                  </div>
                </div>
                <button className="btn-primary" onClick={() => onOpenTrialRoom?.({ title: post.garmentDesc || post.title, imageUrl: post.garmentImageUrl || post.productImageUrl || post.resultImageUrl })} style={{ padding: '8px 18px', borderRadius: '16px', fontSize: '13px' }}>Try On</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* APP DOWNLOAD — last scroll-snap card */}
      <div style={{ position: 'relative', width: '100%', height: '100vh', scrollSnapAlign: 'start', scrollSnapStop: 'always', background: '#080808', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflow: 'hidden' }}>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '-15%', left: '-20%', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(196,120,90,0.07)', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '-15%', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(196,120,90,0.05)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(196,120,90,0.15)', border: `1px solid rgba(196,120,90,0.3)`, borderRadius: '20px', padding: '6px 14px', marginBottom: '22px' }}>
            <Sparkles size={13} color={theme.colors.primary} />
            <span style={{ fontSize: '12px', fontWeight: '800', color: theme.colors.primaryLight, letterSpacing: '0.5px' }}>TRIALIX AI APP</span>
          </div>

          <h2 style={{ fontFamily: 'Outfit,sans-serif', fontSize: '30px', fontWeight: '900', color: 'white', lineHeight: 1.15, marginBottom: '10px', letterSpacing: '-0.5px' }}>
            Try On Any Outfit<br /><span style={{ color: theme.colors.primary }}>Instantly</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.5, marginBottom: '28px' }}>Upload your photo. Pick any garment. AI dresses you in seconds.</p>

          {/* QR + text */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,120,90,0.2)', borderRadius: '24px', padding: '20px', marginBottom: '20px', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', justifyContent: 'center' }}>
              <div style={{ background: '#151515', borderRadius: '14px', padding: '8px', border: '1px solid rgba(196,120,90,0.2)', flexShrink: 0 }}>
                <img src={QR_URL} alt="Scan to Download" width={110} height={110} style={{ display: 'block', borderRadius: '8px' }}
                  onError={e => { e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(APP_DOWNLOAD_URL)}`; }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '5px' }}>📱 Scan to Download</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>Point your camera at the QR code</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>Android</span>
                  <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: '700' }}>iOS</span>
                </div>
              </div>
            </div>
          </div>

          <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '16px', borderRadius: '20px', fontSize: '16px', fontWeight: '900', background: `linear-gradient(135deg,${theme.colors.primary},#D4815A)`, color: 'white', textDecoration: 'none', boxShadow: '0 12px 32px rgba(196,120,90,0.4)', letterSpacing: '0.3px' }}>
            <Download size={18} /> Download TrialX AI — Free
          </a>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '14px' }}>Powered by Expo · No subscription required</p>
        </div>
      </div>

      {activePost && renderCommentsModal()}
    </div>
  );

  function renderCommentsModal() {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: isDesktop ? 'center' : 'flex-end', padding: isDesktop ? '20px' : '0' }}>
        <div style={{ background: isDesktop ? '#121212' : 'white', width: '100%', maxWidth: '480px', height: '65vh', borderRadius: isDesktop ? '24px' : '24px 24px 0 0', display: 'flex', flexDirection: 'column', padding: '20px', color: isDesktop ? 'white' : theme.colors.text, border: isDesktop ? '1px solid #262626' : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800 }}>Comments ({comments.length})</h3>
            <button onClick={() => setActivePost(null)} style={{ background: isDesktop ? '#262626' : theme.colors.bgWarm, border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDesktop ? 'white' : 'black' }}><X size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {comments.length === 0
              ? <p style={{ color: isDesktop ? '#888' : theme.colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 }}>No comments yet. Start the conversation!</p>
              : comments.map(c => (
                <div key={c.id} style={{ background: isDesktop ? '#1e1e1e' : theme.colors.bgWarm, padding: '10px 14px', borderRadius: 14 }}>
                  <strong style={{ fontSize: 13, color: isDesktop ? theme.colors.primaryLight : theme.colors.primaryDark }}>{c.user}</strong>
                  <p style={{ fontSize: 14, marginTop: 2, color: isDesktop ? '#ddd' : theme.colors.text }}>{c.text}</p>
                </div>
              ))
            }
          </div>
          <form onSubmit={handleSendComment} style={{ display: 'flex', gap: 10 }}>
            <input type="text" placeholder="Write a comment..." value={commentText} onChange={e => setCommentText(e.target.value)}
              style={{ flex: 1, padding: 12, borderRadius: 14, border: isDesktop ? '1px solid #363636' : `1px solid ${theme.colors.border}`, fontSize: 14, outline: 'none', background: isDesktop ? '#1e1e1e' : 'white', color: isDesktop ? 'white' : 'black' }} />
            <button className="btn-primary" type="submit" style={{ padding: '12px 18px', borderRadius: 14 }}><Send size={16} /></button>
          </form>
        </div>
      </div>
    );
  }
}
