/**
 * Navbar Component \u2014 Top navigation bar with logo and menu links.
 * \"Explore\" and \"Discuss\" links are placeholder (disabled) for future features.
 */
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
                    <li>
                        <a href="#" className="navbar-link-disabled">
                            Explore
                        </a>
                    </li>
                    <li>
                        <a href="#" className="navbar-link-disabled">
                            Discuss
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
    );
};

export default Navbar;
