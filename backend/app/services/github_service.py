"""
GitHub integration service — Phase 2.

Uses PyGithub 2.x (installed as PyGithub>=2.0.0).
Key API changes in PyGithub 2.x vs 1.x that are verified here:
  - Authentication now uses `github.Auth.Token` passed to `Github(auth=...)`.
    The old positional `Github("token")` still works but is deprecated.
  - `repo.create_issue(title, body=...)` signature is unchanged.
  - Issue objects have `.number` (int) and `.html_url` (str).
"""
import logging
from typing import Optional

logger = logging.getLogger("github_service")


def create_github_issue(
    bug_id: str,
    title: str,
    description: str,
    frontend_url: str,
) -> Optional[dict]:
    """
    Create a GitHub issue for the given bug.

    Returns a dict with {"github_issue_id": str, "github_issue_url": str}
    on success, or None if the call fails (caller should continue, not abort).
    """
    try:
        from app.config import settings
        import github as pygithub

        pat = settings.GITHUB_PAT
        owner = settings.GITHUB_REPO_OWNER
        repo_name = settings.GITHUB_REPO_NAME

        if not pat or not owner or not repo_name:
            logger.warning(
                "[GITHUB] Skipping issue creation: GITHUB_PAT / GITHUB_REPO_OWNER / "
                "GITHUB_REPO_NAME are not configured."
            )
            return None

        # PyGithub 2.x auth object (verified against PyGithub 2.10.0 source)
        auth = pygithub.Auth.Token(pat)
        gh = pygithub.Github(auth=auth)

        repo = gh.get_repo(f"{owner}/{repo_name}")

        bug_url = f"{frontend_url.rstrip('/')}/bugs/{bug_id}"
        body = (
            f"{description}\n\n"
            f"---\n"
            f"🔗 Linked bug: [{bug_url}]({bug_url})\n"
            f"Bug ID: `{bug_id}`"
        )

        issue = repo.create_issue(title=title, body=body)

        logger.info(
            f"[GITHUB] Created issue #{issue.number} for bug {bug_id}: {issue.html_url}"
        )
        return {
            "github_issue_id": str(issue.number),
            "github_issue_url": issue.html_url,
        }

    except Exception as exc:
        logger.error(
            f"[GITHUB] Failed to create issue for bug {bug_id}: {exc!r}. "
            "Bug creation will continue without a linked GitHub issue."
        )
        return None
