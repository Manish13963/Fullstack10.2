import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  query,
  setLogLevel
} from 'firebase/firestore';

// --- Firebase Configuration ---
// These global variables are provided by the environment.
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Firestore Collections ---
// Using public paths for a collaborative blog
const usersCollectionPath = `/artifacts/${appId}/public/data/users`;
const postsCollectionPath = `/artifacts/${appId}/public/data/posts`;
const getCommentsCollectionPath = (postId) => `/artifacts/${appId}/public/data/posts/${postId}/comments`;

// --- Helper Components ---

/**
 * A reusable loading spinner
 */
const Spinner = () => (
  <div className="flex justify-center items-center p-4">
    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

/**
 * A reusable component for showing error messages
 */
const ErrorDisplay = ({ message }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

/**
 * Navigation Bar Component
 */
const Navbar = ({ user, userData, onNavigate, onSignOut }) => (
  <nav className="bg-white shadow-md w-full p-4 flex justify-between items-center rounded-lg">
    <h1 
      className="text-2xl font-bold text-blue-600 cursor-pointer" 
      onClick={() => onNavigate('HOME')}
    >
      FireBlog
    </h1>
    <div className="flex items-center space-x-4">
      <button 
        onClick={() => onNavigate('HOME')} 
        className="text-gray-700 hover:text-blue-600 font-medium"
      >
        Home
      </button>
      {user && (
        <button 
          onClick={() => onNavigate('PROFILE')} 
          className="text-gray-700 hover:text-blue-600 font-medium"
        >
          Profile
        </button>
      )}
      {user ? (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 hidden sm:block">
            Hi, {userData?.displayName || user.email}
          </span>
          <button 
            onClick={onSignOut} 
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <span className="text-gray-500">Please sign in</span>
      )}
    </div>
  </nav>
);

/**
 * Authentication View (Sign-In Button)
 */
const AuthView = ({ onSignIn }) => (
  <div className="flex flex-col items-center justify-center p-8 mt-10 bg-white rounded-lg shadow-xl max-w-md mx-auto">
    <h2 className="text-2xl font-semibold mb-4">Welcome to FireBlog</h2>
    <p className="text-gray-600 mb-6 text-center">Sign in to read posts, write your own, and join the conversation.</p>
    <button 
      onClick={onSignIn}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg flex items-center space-x-2 transition duration-200"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /><path d="M1 1h22v22H1z" fill="none" /></svg>
      <span>Sign in with Google</span>
    </button>
  </div>
);

/**
 * Home View (List of all posts)
 */
const HomeView = ({ posts, onSelectPost }) => (
  <div className="mt-6">
    <h2 className="text-3xl font-semibold mb-4 text-gray-800">All Posts</h2>
    <div className="space-y-4">
      {posts.length === 0 && <p className="text-gray-500">No posts yet. Be the first!</p>}
      {posts.map(post => (
        <div 
          key={post.id}
          className="bg-white p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-200"
          onClick={() => onSelectPost(post.id)}
        >
          <h3 className="text-2xl font-bold text-blue-700 mb-2">{post.title}</h3>
          <p className="text-gray-500 text-sm">
            By {post.authorName || 'Anonymous'} on {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : '...'}
          </p>
          <p className="text-gray-700 mt-2 truncate">{post.content}</p>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Post Detail View (Single post + comments)
 */
const PostDetailView = ({ post, comments, onAddComment, user, userData }) => {
  const [commentText, setCommentText] = useState('');

  if (!post) return <Spinner />;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (commentText.trim() && user && userData) {
      onAddComment(commentText, user.uid, userData.displayName);
      setCommentText('');
    }
  };

  return (
    <div className="mt-6 bg-white p-8 rounded-lg shadow-2xl">
      {/* Post Content */}
      <h2 className="text-4xl font-bold text-gray-900 mb-3">{post.title}</h2>
      <p className="text-gray-500 text-sm mb-4">
        By {post.authorName || 'Anonymous'} on {post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString() : '...'}
      </p>
      <div className="prose prose-lg max-w-none text-gray-800 whitespace-pre-wrap">
        {post.content}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="mt-8 border-t pt-6">
        <h3 className="text-xl font-semibold mb-3 text-gray-800">Add a Comment</h3>
        <textarea
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          rows="3"
          placeholder="Write your comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        ></textarea>
        <button 
          type="submit" 
          className="mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg transition duration-200"
        >
          Post Comment
        </button>
      </form>

      {/* Comments List */}
      <div className="mt-8">
        <h3 className="text-2xl font-semibold mb-4 text-gray-800">Comments ({comments.length})</h3>
        <div className="space-y-4">
          {comments.length === 0 && <p className="text-gray-500">No comments yet.</p>}
          {comments.map(comment => (
            <div key={comment.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700">{comment.text}</p>
              <p className="text-gray-500 text-sm mt-2">
                By {comment.authorName || 'Anonymous'} on {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleDateString() : '...'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Profile View (Update profile + Create post)
 */
const ProfileView = ({ userData, onUpdateProfile, onCreatePost, user }) => {
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');

  useEffect(() => {
    if (userData?.displayName) {
      setDisplayName(userData.displayName);
    }
  }, [userData]);

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    if (displayName.trim()) {
      onUpdateProfile(displayName);
    }
  };

  const handlePostCreate = (e) => {
    e.preventDefault();
    if (postTitle.trim() && postContent.trim() && user && userData) {
      onCreatePost(postTitle, postContent, user.uid, userData.displayName);
      setPostTitle('');
      setPostContent('');
    }
  };

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Update Profile Card */}
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Your Profile</h2>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Update Profile
          </button>
        </form>
      </div>

      {/* Create Post Card */}
      <div className="bg-white p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Create New Post</h2>
        <form onSubmit={handlePostCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows="6"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            ></textarea>
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
          >
            Publish Post
          </button>
        </form>
      </div>
    </div>
  );
};


/**
 * Main Application Component
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [view, setView] = useState('HOME'); // 'HOME', 'POST_DETAIL', 'PROFILE'
  const [selectedPostId, setSelectedPostId] = useState(null);

  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // --- Auth Effect ---
  useEffect(() => {
    setLogLevel('Debug');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
      } else if (initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
          // onAuthStateChanged will run again with the new user
        } catch (e) {
          console.error("Error signing in with custom token:", e);
          await signInAnonymously(auth); // Fallback
        }
      } else {
        // No user, no token, sign in anonymously for basic access
        await signInAnonymously(auth);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- User Data Listener ---
  useEffect(() => {
    if (user && isAuthReady) {
      const userDocRef = doc(db, usersCollectionPath, user.uid);
      const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
        } else {
          // If profile doesn't exist (e.g., first sign-in), create it
          setDoc(userDocRef, { 
            displayName: user.displayName || 'Anonymous User',
            email: user.email 
          }, { merge: true });
        }
      });
      return () => unsubscribe();
    } else if (!user && isAuthReady) {
      setUserData(null);
    }
  }, [user, isAuthReady]);

  // --- Posts Listener ---
  useEffect(() => {
    if (!isAuthReady) return;
    
    setLoading(true);
    const q = query(collection(db, postsCollectionPath));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in-memory (descending) as per instructions
      postsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(postsData);
      setLoading(false);
    }, (e) => {
      console.error("Error fetching posts: ", e);
      setError("Failed to load posts.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  // --- Comments Listener ---
  useEffect(() => {
    if (!isAuthReady || !selectedPostId) {
      setComments([]); // Clear comments if no post is selected
      return;
    }

    setLoading(true);
    const commentsColRef = collection(db, getCommentsCollectionPath(selectedPostId));
    const q = query(commentsColRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort in-memory (ascending)
      commentsData.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setComments(commentsData);
      setLoading(false);
    }, (e) => {
      console.error("Error fetching comments: ", e);
      setError("Failed to load comments.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthReady, selectedPostId]);

  // --- Event Handlers ---

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Create or merge user profile in Firestore
      const userDocRef = doc(db, usersCollectionPath, user.uid);
      await setDoc(userDocRef, {
        displayName: user.displayName,
        email: user.email
      }, { merge: true });

    } catch (e) {
      console.error("Sign-in error: ", e);
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
    setView('HOME'); // Go to home on sign out
    // Sign in anonymously again
    await signInAnonymously(auth);
  };

  const handleNavigate = (targetView) => {
    setError(null); // Clear errors on navigation
    if (targetView === 'HOME') {
      setSelectedPostId(null);
    }
    setView(targetView);
  };

  const handleSelectPost = (postId) => {
    setSelectedPostId(postId);
    setView('POST_DETAIL');
  };

  const handleUpdateProfile = async (newDisplayName) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const userDocRef = doc(db, usersCollectionPath, user.uid);
      await setDoc(userDocRef, { displayName: newDisplayName }, { merge: true });
    } catch (e) {
      console.error("Profile update error: ", e);
      setError(e.message);
    }
    setLoading(false);
  };

  const handleCreatePost = async (title, content, authorId, authorName) => {
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, postsCollectionPath), {
        title,
        content,
        authorId,
        authorName,
        createdAt: serverTimestamp()
      });
      setView('HOME'); // Go to home after creating post
    } catch (e) {
      console.error("Create post error: ", e);
      setError(e.message);
    }
    setLoading(false);
  };

  const handleAddComment = async (text, authorId, authorName) => {
    if (!selectedPostId) return;
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, getCommentsCollectionPath(selectedPostId)), {
        text,
        authorId,
        authorName,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Add comment error: ", e);
      setError(e.message);
    }
    setLoading(false);
  };

  // --- Memoized Values ---
  const selectedPost = useMemo(() => {
    return posts.find(p => p.id === selectedPostId);
  }, [posts, selectedPostId]);

  // --- Render Logic ---

  const renderView = () => {
    if (!isAuthReady) {
      return <Spinner />;
    }

    // User must be "signed in" (even if anonymous) to see content.
    // We check if the user is *not* anonymous to show profile/create forms.
    const isRealUser = user && !user.isAnonymous;

    if (!isRealUser) {
      // Show auth view if not signed in with a provider
      return <AuthView onSignIn={handleSignIn} />;
    }

    switch (view) {
      case 'HOME':
        return <HomeView posts={posts} onSelectPost={handleSelectPost} />;
      case 'POST_DETAIL':
        return <PostDetailView 
          post={selectedPost} 
          comments={comments} 
          onAddComment={handleAddComment}
          user={user}
          userData={userData}
        />;
      case 'PROFILE':
        return <ProfileView 
          userData={userData} 
          onUpdateProfile={handleUpdateProfile} 
          onCreatePost={handleCreatePost}
          user={user}
        />;
      default:
        return <HomeView posts={posts} onSelectPost={handleSelectPost} />;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-inter">
      <div className="container mx-auto p-4 max-w-4xl">
        <Navbar 
          user={user && !user.isAnonymous ? user : null} 
          userData={userData}
          onNavigate={handleNavigate} 
          onSignOut={handleSignOut} 
        />
        
        {error && <ErrorDisplay message={error} />}
        
        {loading && <Spinner />}
        
        <main>
          {renderView()}
        </main>
      </div>
    </div>
  );
}
