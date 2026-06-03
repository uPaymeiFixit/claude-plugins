#!/usr/bin/env bash
# Create a GitLab project under a personal namespace and push the workspace to it (SSH).
# Idempotent-ish: if the project already exists, it just wires the remote and pushes.
#
# Usage:
#   publish_workspace.sh --dir <workspace-dir> --namespace <username> --name <project-name> \
#                        [--host <gitlab-host>] [--visibility private]
# --host defaults to the host derived from the workspace repos' git remotes.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DIR="" HOST="" NAMESPACE="" NAME="" VIS="private"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --namespace) NAMESPACE="$2"; shift 2;;
    --name) NAME="$2"; shift 2;;
    --visibility) VIS="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
[[ -n "$DIR" && -n "$NAMESPACE" && -n "$NAME" ]] || {
  echo "missing required arg (--dir --namespace --name)" >&2; exit 2; }
[[ -d "$DIR/.git" ]] || { echo "not a git repo: $DIR" >&2; exit 2; }

if [[ -z "$HOST" ]]; then
  HOST="$(python3 "$SCRIPT_DIR/workspace.py" host --dir "$DIR")" || HOST=""
  [[ -n "$HOST" ]] || { echo "could not derive GitLab host from repo remotes; pass --host" >&2; exit 3; }
  echo "derived host from repo remotes: $HOST" >&2
fi

command -v glab >/dev/null || { echo "glab (GitLab CLI) not found on PATH" >&2; exit 3; }
export GITLAB_HOST="$HOST"

if ! glab auth status --hostname "$HOST" >/dev/null 2>&1; then
  echo "glab is not authenticated to $HOST." >&2
  echo "Fix: run  glab auth login --hostname $HOST  (choose SSH), then re-run." >&2
  exit 3
fi

# pre-flight: can this account create projects in its personal namespace?
CAN_CREATE="$(glab api user 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('can_create_project'))" 2>/dev/null || true)"
if [[ "$CAN_CREATE" == "False" ]]; then
  echo "Your GitLab account on $HOST can't create projects in your personal namespace (account marked External)." >&2
  if [[ "$HOST" == "gitlabdev.paciolan.info" ]]; then
    echo "Fix: in Slack #devops-support, send this and wait for it to be applied:" >&2
    echo "  @pac-devops-support can you please uncheck the box marking my Gitlab account as external so that I can create projects under my personal namespace?" >&2
  else
    echo "Fix: ask your GitLab administrator to enable project creation for your personal namespace." >&2
  fi
  echo "Then re-run this command." >&2
  exit 4
fi

PROJECT="$NAMESPACE/$NAME"
SSH_URL="git@$HOST:$PROJECT.git"

# create the remote project (ignore "already exists")
if ! glab repo create "$PROJECT" --"$VIS" >/dev/null 2>&1; then
  echo "note: glab repo create reported an error (project may already exist) — continuing" >&2
fi

# wire the SSH remote explicitly (don't trust glab's default protocol)
git -C "$DIR" remote remove origin 2>/dev/null || true
git -C "$DIR" remote add origin "$SSH_URL"

# commit anything pending, then push
git -C "$DIR" add -A
git -C "$DIR" commit -q -m "create $NAME workspace" 2>/dev/null || true
BRANCH="$(git -C "$DIR" symbolic-ref --short HEAD 2>/dev/null || echo main)"
git -C "$DIR" push -u origin "$BRANCH"

echo "pushed to $SSH_URL (branch $BRANCH)"
echo "https://$HOST/$PROJECT"
