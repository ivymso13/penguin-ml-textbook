import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {blankCourse,saveCourse,readCourses} from '../web/course-format.js';
import {readWorkspace,trashCourse,restoreCourse,hidePublicCourse,restorePublicCourse,visiblePosts,savePost,trashPost,restorePost} from '../web/workspace.js';
function memory(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}
test('course trash persists across reads and restores without changing student work',()=>{const s=memory(),a=blankCourse(),b=blankCourse();saveCourse(a,s);saveCourse(b,s);s.setItem('student','keep');trashCourse(a.id,s);assert.equal(readCourses(s).length,1);assert.equal(readWorkspace(s).deletedCourses[0].id,a.id);restoreCourse(a.id,s);assert.equal(readCourses(s).length,2);assert.equal(readWorkspace(s).deletedCourses.length,0);assert.equal(s.getItem('student'),'keep');});
test('public course hiding is local and reversible',()=>{const s=memory();hidePublicCourse('penguins',s);assert.deepEqual(readWorkspace(s).hiddenCourses,['penguins']);restorePublicCourse('penguins',s);assert.deepEqual(readWorkspace(s).hiddenCourses,[]);});
test('board creates edits deletes and restores default and custom posts',()=>{const s=memory(),defaults=[{id:'welcome',title:'안내',body:'기본',label:'수업 안내'}];const p={id:'new',title:'새 글',body:'내용',label:'내 안내'};savePost(p,s);savePost({...p,body:'수정'},s);assert.equal(visiblePosts(defaults,s).length,2);assert.equal(visiblePosts(defaults,s)[0].body,'수정');trashPost(visiblePosts(defaults,s)[0],s);assert.equal(visiblePosts(defaults,s).length,1);restorePost('new',s);assert.equal(visiblePosts(defaults,s)[0].body,'수정');trashPost(defaults[0],s);assert.equal(visiblePosts(defaults,s).some(p=>p.id==='welcome'),false);restorePost('welcome',s);assert.equal(visiblePosts(defaults,s).length,2);});
