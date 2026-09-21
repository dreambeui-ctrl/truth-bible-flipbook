import { createRoot } from 'react-dom/client';

import '../app/globals.css';
import { FlipbookViewer } from '../components/flipbook-viewer';
import './fonts.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Static flipbook root element was not found');
}

createRoot(root).render(<FlipbookViewer />);
