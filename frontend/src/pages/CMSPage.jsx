import React, { useState } from 'react'
import { FiEdit, FiImage, FiFileText } from 'react-icons/fi'

function CMSPage() {
  const [activePage, setActivePage] = useState('home')
  const [homeContent, setHomeContent] = useState({
    hero_title: 'MinimalMod - Marketplace Platform',
    hero_subtitle: 'No distractions, Just results',
    about_text: 'Premium marketplace for quality products'
  })

  const savePage = () => {
    alert('Page content saved!')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">CMS / SITE MANAGEMENT</h2>
        <p className="comment">// Manage website content</p>
      </div>

      {/* Page Selector */}
      <div className="grid grid-cols-4 gap-4">
        {['home', 'about', 'delivery', 'contacts'].map((page) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`card-neon p-4 text-center transition-all ${
              activePage === page ? 'border-mm-purple' : ''
            }`}
          >
            <FiFileText className="mx-auto mb-2 text-mm-cyan" size={24} />
            <p className="font-mono text-sm uppercase">{page}</p>
          </button>
        ))}
      </div>

      {/* Editor */}
      {activePage === 'home' && (
        <div className="card-neon">
          <h3 className="text-xl mb-4 text-mm-cyan uppercase flex items-center">
            <FiEdit className="mr-2" />
            Edit Home Page
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Hero Title</label>
              <input
                type="text"
                value={homeContent.hero_title}
                onChange={(e) => setHomeContent({...homeContent, hero_title: e.target.value})}
                className="input-neon w-full"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Hero Subtitle</label>
              <input
                type="text"
                value={homeContent.hero_subtitle}
                onChange={(e) => setHomeContent({...homeContent, hero_subtitle: e.target.value})}
                className="input-neon w-full"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">About Text</label>
              <textarea
                value={homeContent.about_text}
                onChange={(e) => setHomeContent({...homeContent, about_text: e.target.value})}
                className="input-neon w-full"
                rows="6"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                <FiImage className="inline mr-2" />
                Hero Banner
              </label>
              <div className="border-2 border-dashed border-mm-border p-8 text-center">
                <FiImage className="mx-auto text-mm-text-tertiary mb-2" size={48} />
                <p className="text-mm-text-secondary mb-2">Upload hero banner</p>
                <p className="comment text-xs">// Drag & drop or click to upload</p>
              </div>
            </div>

            <button onClick={savePage} className="btn-primary w-full">
              SAVE CHANGES
            </button>
          </div>
        </div>
      )}

      {activePage !== 'home' && (
        <div className="card-neon text-center py-12">
          <FiFileText className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">Page Editor</p>
          <p className="comment">// Edit {activePage} page content</p>
        </div>
      )}
    </div>
  )
}

export default CMSPage
