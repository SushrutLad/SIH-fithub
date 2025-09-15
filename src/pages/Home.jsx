import React from 'react'
import { Link } from 'react-router-dom'

export default function Home({ user }){
  return (
    <div className="grid-tiles">
      <div className="tile">
        <h2>Health Tracker</h2>
        <p>Calories, water, sleep and steps — click to open full tracker.</p>
        <Link to="/tracker" className="btn">Open Tracker</Link>
      </div>
      <div className="tile">
        <h2>Live Form Correction</h2>
        <p>Open MoveNet page for live webcam or MP4 upload analysis.</p>
        <Link to="/movenet" className="btn">Open MoveNet</Link>
      </div>
      <div className="tile">
        <h2>Community Blog</h2>
        <p>Discuss tips and post questions. Role-based privileges for Pros.</p>
        <Link to="/blog" className="btn">Open Blog</Link>
      </div>
      <div className="tile">
        <h2>Your Progress</h2>
        <p>Points and rewards earned for good form.</p>
        <Link to="/tracker" className="btn">View Progress</Link>
      </div>
    </div>
  )
}
