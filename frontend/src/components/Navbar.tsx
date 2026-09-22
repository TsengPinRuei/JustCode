import { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: FC = () => {
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <Link to="/" className="navbar-logo">
                    JustCode_
                </Link>
                <ul className="navbar-menu">
                    <li>
                        <Link to="/problems" className={location.pathname.includes('/problems') ? 'active' : ''}>
                            Problems
                        </Link>
                    </li>
                    {/* Explore and Discuss are placeholders with no routes yet. */}
                    <li className="navbar-disabled-item">
                        <span className="navbar-link-disabled" aria-disabled="true">
                            Explore
                        </span>
                    </li>
                    <li className="navbar-disabled-item">
                        <span className="navbar-link-disabled" aria-disabled="true">
                            Discuss
                        </span>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
