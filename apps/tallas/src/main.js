import ReactDOM from 'react-dom/client';
import {html} from './lib.js';
import App from './App.js';
import AuthGate from './AuthGate.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(html`<${AuthGate}><${App}/></${AuthGate}>`);
