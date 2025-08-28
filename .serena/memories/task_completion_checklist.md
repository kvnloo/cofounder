# Task Completion Checklist

When completing any development task, ensure:

## Code Quality
- [ ] Code follows project conventions (kebab-case files, camelCase methods)
- [ ] Proper error handling with try-catch blocks
- [ ] Async/await used consistently
- [ ] No console.log statements left in production code

## Testing
- [ ] Run authentication tests: `node test-auth.js`
- [ ] Test both authentication providers if modified
- [ ] Verify dashboard still loads properly
- [ ] Check socket.io connections work

## Documentation
- [ ] Update relevant README if API changes
- [ ] Document new environment variables
- [ ] Add inline comments for complex logic
- [ ] Update integration guides if needed

## Version Control
- [ ] Review changes: `git diff`
- [ ] Commit to feature branch (not main/dev)
- [ ] Write descriptive commit messages
- [ ] Follow conventional commits (feat:, fix:, docs:)

## Verification
- [ ] Server starts without errors
- [ ] Dashboard connects properly
- [ ] Authentication works as expected
- [ ] No regression in existing features