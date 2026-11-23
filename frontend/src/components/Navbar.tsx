import { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

const wordmark = ` ### #  #  ### #####  ###  ##  ###  ####
   # #  # #      #   #    #  # #  # #
   # #  #  ##    #   #    #  # #  # ###
#  # #  #    #   #   #    #  # #  # #
 ##   ##  ###    #    ###  ##  ###  #### __`;

const Navbar: FC = () => {
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <Link to="/" className="navbar-logo" aria-label="JustCode home">
                    <span className="navbar-logo-art" aria-hidden="true">{wordmark}</span>
                </Link>
                <ul className="navbar-menu">
                    <li>
                        <Link to="/problems" className={location.pathname.includes('/problems') ? 'active' : ''}>
                            Problems
                        </Link>
                    </li>
                    <li><Link to="/activity" className={location.pathname === '/activity' ? 'active' : ''}>Activity</Link></li>
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
